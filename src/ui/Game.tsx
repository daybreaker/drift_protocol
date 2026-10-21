import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cost,
  isLegal,
  neutralizeCost,
  perkActive,
  previewPlay,
  salvageCost,
  SUITS,
  type Action,
  type Card,
  type GameState,
  type Side,
} from '../engine'
import { Course, ModuleTile, Outcome, Pool, StatusBar, Zone } from './Board'
import { CardView } from './Card'
import { DecisionPanel } from './DecisionPanel'
import { Hand } from './Hand'
import { orderHand } from './handLayout'
import { InspectContext } from './inspect'
import { Inspector } from './Inspector'
import { locate } from './locate'
import { RAIL_SLOTS, railLeftToRight } from './text'
import { Tray, type Preview } from './Tray'
import type { Session } from './useGame'

interface Props {
  session: Session
  act: (action: Action) => void
  undo: () => void
  quit: () => void
  setHandOrder: (ids: string[]) => void
}

export function Game({ session, act, undo, quit, setHandOrder }: Props) {
  const { game } = session
  const [inspectedId, setInspectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  /**
   * Cards the player has turned from their default orientation, keyed to where they were turned
   * (turn and place), so a card that moves or comes back next turn starts fresh.
   */
  const [turned, setTurned] = useState<Record<string, string>>({})

  // Everything the player sees reflects the tentative play while there is one.
  const view = useMemo(() => (preview ? previewPlay(game, preview.cardId, preview.side) : game), [game, preview])
  const place = useCallback((id: string) => `${game.turn}|${locate(game, id).where}`, [game])
  const isTurned = (id: string) => turned[id] === place(id)
  const toggleTurned = (id: string) =>
    setTurned((t) => {
      const next = { ...t }
      if (next[id] === place(id)) delete next[id]
      else next[id] = place(id)
      return next
    })

  /** Hand cards face action side up unless turned; that is also the side Add to Circuit plays. */
  const handSide = (card: Card): Side => (isTurned(card.id) ? 'resource' : 'action')

  const run = (action: Action) => {
    setPreview(null)
    act(action)
  }
  const can = (action: Action) => isLegal(game, action)

  const inspected = useMemo(() => (inspectedId ? findCard(game, inspectedId) : null), [game, inspectedId])

  /** Turning the tentative play switches its side; any other card just turns. */
  const turn = (card: Card) => {
    if (preview?.cardId === card.id) setPreview({ ...preview, side: preview.side === 'action' ? 'resource' : 'action' })
    else toggleTurned(card.id)
  }

  const inspectValue = {
    inspectedId,
    inspect: (card: Card) => setInspectedId(card.id),
    activate: (card: Card) => (card.id === inspectedId ? turn(card) : setInspectedId(card.id)),
  }

  // The inspector shows Circuit cards on the side they were played, everything else action side up by default.
  const inspectorFlipped = (() => {
    if (!inspected) return false
    const entry = view.circuit.find((e) => e.card.id === inspected.id)
    if (preview?.cardId === inspected.id) return preview.side === 'action'
    const base = entry ? entry.side === 'action' : true
    return base !== isTurned(inspected.id)
  })()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape') {
        if (preview) setPreview(null)
        else setInspectedId(null)
      }
      if ((e.key === 'f' || e.key === 'F') && inspected) turn(inspected)
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        if (preview) {
          e.preventDefault()
          run({ type: 'playCard', cardId: preview.cardId, side: preview.side })
        } else if (inspected && game.hand.some((c) => c.id === inspected.id) && game.pending.length === 0) {
          e.preventDefault()
          setPreview({ cardId: inspected.id, side: handSide(inspected) })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hand = useMemo(() => orderHand(game.hand, session.handOrder ?? []), [game.hand, session.handOrder])
  const stationCandidate = !preview && inspected && game.hand.some((c) => c.id === inspected.id) ? inspected : null

  return (
    <InspectContext.Provider value={inspectValue}>
      <div className="game">
        <StatusBar game={game} canUndo={session.undo.length > 0} undo={() => { setPreview(null); undo() }} quit={quit} />

        <Zone area="rail" title="Cargo Rail" note={game.calm ? 'Calm start: drifting cards are debris until your first reshuffle.' : undefined}>
          <div className="rail">
            {railLeftToRight(game.rail).map(([card, i]) => {
              const vents = i === 0 || (i === 1 && game.logs.log2 === 'A')
              return (
                <div key={i} className={`slot ${vents ? 'is-venting' : ''}`}>
                  {card ? (
                    <CardView card={card} size="sm">
                      <span className="cost-tag" data-affordable={can({ type: 'salvage', railIndex: i })}>
                        {salvageCost(game, i)}
                      </span>
                    </CardView>
                  ) : (
                    <div className="empty-slot card-sm">Salvaged</div>
                  )}
                  <span className="slot-label">
                    {RAIL_SLOTS[i]}
                    {i === 0 && <em> −2</em>}
                    {i === 1 && <em> −1</em>}
                  </span>
                </div>
              )
            })}
          </div>
        </Zone>

        <Zone area="threat" title="Threat zone" tone={game.threat.length ? 'danger' : undefined}>
          {game.threat.length === 0 ? (
            <p className="empty-note">No hazards. A Cost 3 or 5 card that drifts out of the Airlock lands here and hits at the end of your next turn.</p>
          ) : (
            <div className="row">
              {game.threat.map((card, i) => (
                <CardView key={card.id} card={card} size="sm">
                  <span className="cost-tag" data-affordable={can({ type: 'neutralize', threatIndex: i, keep: 'archive' })}>
                    {neutralizeCost(game, i, 'archive')}
                  </span>
                </CardView>
              ))}
            </div>
          )}
        </Zone>

        <Zone area="modules" title="Modules">
          <div className="modules">
            {SUITS.map((m) => {
              const station: Action | null = stationCandidate ? { type: 'station', cardId: stationCandidate.id, module: m } : null
              return (
                <ModuleTile
                  key={m}
                  game={game}
                  module={m}
                  station={station && can(station) ? () => run(station) : undefined}
                  stationCost={stationCandidate ? cost(stationCandidate.rank) : 0}
                />
              )
            })}
          </div>
        </Zone>

        <Zone area="course" title="Course">
          <Course game={game} view={view} />
        </Zone>

        <Zone area="circuit" title="Circuit">
          <div className="circuit-wrap">
            <div className="circuit">
              {view.circuit.length === 0 ? (
                <div className="empty-note circuit-empty">
                  {session.summary.length > 0 && (
                    <ul className="summary">
                      {session.summary.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  )}
                  <p>Play cards from your hand here, one at a time. Each card checks only the card before it.</p>
                </div>
              ) : (
                view.circuit.map((e) => (
                  <div key={e.card.id} className="circuit-entry">
                    <CardView card={e.card} size="md" flipped={e.side === 'action'} ghost={preview?.cardId === e.card.id} />
                    <div className="tags">
                      {e.synced && <span className="tag" data-suit={e.card.suit}>Sync</span>}
                      {e.cascaded && <span className="tag" data-suit="power">Cascade</span>}
                      {e.plotted && <span className="tag" data-suit="data">Plotted</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
            <Pool game={game} view={view} />
          </div>
        </Zone>

        <div className="tray-area">
          {game.pending.length > 0 ? (
            <DecisionPanel game={game} act={run} />
          ) : (
            <Tray game={game} view={view} inspectedId={inspectedId} preview={preview} setPreview={setPreview} handSide={handSide} run={run} can={can} />
          )}
        </div>

        <Zone area="hand" title={`Hand (${game.hand.length})`}>
          <Hand
            cards={hand}
            previewId={preview?.cardId ?? null}
            flipped={(card) => handSide(card) === 'action'}
            onReorder={setHandOrder}
            emptyNote={`Your hand is empty. End the turn to draw ${perkActive(game, 'crew') ? 6 : 5}.`}
          />
        </Zone>

        <Inspector
          card={inspected}
          game={game}
          view={view}
          preview={preview}
          setPreview={setPreview}
          flipped={inspectorFlipped}
          turn={() => inspected && turn(inspected)}
          handSide={handSide}
          run={run}
          can={can}
        />
        {game.outcome && <Outcome game={game} quit={quit} />}
      </div>
    </InspectContext.Provider>
  )
}

/** Finds a card anywhere on the board, so the inspector can keep showing it as it moves. */
function findCard(s: GameState, id: string): Card | null {
  const all = [
    ...s.hand, ...s.deck, ...s.discard, ...s.yard, ...s.threat, ...s.breach, ...s.course, ...s.archive,
    ...s.circuit.map((e) => e.card),
    ...s.rail.filter((c): c is Card => c !== null),
    ...SUITS.flatMap((m) => s.modules[m].stationed),
  ]
  return all.find((c) => c.id === id) ?? null
}
