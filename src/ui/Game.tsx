import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  breachLimit,
  cost,
  isLegal,
  isOnline,
  isStaffed,
  JUMP_THRESHOLDS,
  neutralizeCost,
  perkActive,
  previewPlay,
  salvageCost,
  SUITS,
  yieldOf,
  type Action,
  type Card,
  type GameState,
  type Side,
  type Suit,
} from '../engine'
import { CardView, SuitIcon } from './Card'
import { DecisionPanel } from './DecisionPanel'
import { InspectContext } from './inspect'
import { locate } from './locate'
import { actionName, cardImage, cardName, MODULE_NAME, MODULE_PERK, RAIL_SLOTS, SUIT_NAME, WILD } from './text'
import type { Session } from './useGame'

type Selection =
  | { zone: 'hand'; cardId: string; side: Side }
  | { zone: 'rail'; index: number }
  | { zone: 'threat'; index: number }
  | { zone: 'circuit'; index: number }
  | { zone: 'module'; module: Suit; cardId: string }
  | null

interface Props {
  session: Session
  act: (action: Action) => void
  undo: () => void
  quit: () => void
}

export function Game({ session, act, undo, quit }: Props) {
  const { game } = session
  const [selection, setSelection] = useState<Selection>(null)
  const [inspected, setInspected] = useState<Card | null>(null)
  const inspectValue = useMemo(() => ({ inspectedId: inspected?.id ?? null, inspect: setInspected }), [inspected])

  // Everything the player sees reflects the tentative play while a hand card is selected.
  const view = useMemo(
    () => (selection?.zone === 'hand' ? previewPlay(game, selection.cardId, selection.side) : game),
    [game, selection],
  )
  const run = (action: Action) => {
    setSelection(null)
    act(action)
  }
  const can = (action: Action) => isLegal(game, action)
  const toggle = (next: NonNullable<Selection>) =>
    setSelection(JSON.stringify(selection) === JSON.stringify(next) ? null : next)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape') setSelection(null)
      if (selection?.zone !== 'hand') return
      if (e.key === 'f' || e.key === 'F') setSelection({ ...selection, side: selection.side === 'resource' ? 'action' : 'resource' })
      if (e.key === 'Enter') {
        e.preventDefault()
        setSelection(null)
        act({ type: 'playCard', cardId: selection.cardId, side: selection.side })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, act])

  const pending = game.pending.length > 0
  const over = game.outcome !== null

  return (
    <InspectContext.Provider value={inspectValue}>
      <div className="game">
        <StatusBar game={game} canUndo={session.undo.length > 0} undo={() => { setSelection(null); undo() }} quit={quit} />

        <Zone area="rail" title="Cargo Rail" note={game.calm ? 'Calm start: drifting cards are debris until your first reshuffle.' : undefined}>
          <div className="rail">
            {game.rail.map((card, i) => {
              const slot = RAIL_SLOTS[i]
              const vents = i === 0 || (i === 1 && game.logs.log2 === 'A')
              return (
                <div key={i} className={`slot ${vents ? 'is-venting' : ''}`}>
                  {card ? (
                    <CardView
                      card={card}
                      size="sm"
                      selected={selection?.zone === 'rail' && selection.index === i}
                      disabled={pending || over}
                      onClick={() => toggle({ zone: 'rail', index: i })}
                    >
                      <span className="cost-tag" data-affordable={can({ type: 'salvage', railIndex: i })}>
                        {salvageCost(game, i)}
                      </span>
                    </CardView>
                  ) : (
                    <div className="empty-slot card-sm">Salvaged</div>
                  )}
                  <span className="slot-label">
                    {slot}
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
                <CardView
                  key={card.id}
                  card={card}
                  size="sm"
                  selected={selection?.zone === 'threat' && selection.index === i}
                  disabled={pending || over}
                  onClick={() => toggle({ zone: 'threat', index: i })}
                >
                  <span className="cost-tag" data-affordable={can({ type: 'neutralize', threatIndex: i, keep: 'archive' })}>
                    {neutralizeCost(game, i)}
                  </span>
                </CardView>
              ))}
            </div>
          )}
        </Zone>

        <Zone area="modules" title="Modules">
          <div className="modules">
            {SUITS.map((m) => (
              <ModuleTile
                key={m}
                game={game}
                module={m}
                selection={selection}
                onSelectStationed={(cardId) => toggle({ zone: 'module', module: m, cardId })}
                station={selection?.zone === 'hand' && can({ type: 'station', cardId: selection.cardId, module: m })
                  ? () => run({ type: 'station', cardId: selection.cardId, module: m })
                  : undefined}
                stationCost={selection?.zone === 'hand' ? cost(game.hand.find((c) => c.id === selection.cardId)!.rank) : 0}
              />
            ))}
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
                view.circuit.map((e, i) => {
                  const ghost = selection?.zone === 'hand' && i === view.circuit.length - 1
                  return (
                    <div key={e.card.id} className="circuit-entry">
                      <CardView
                        card={e.card}
                        size="md"
                        flipped={e.side === 'action'}
                        ghost={ghost}
                        selected={selection?.zone === 'circuit' && selection.index === i}
                        disabled={pending || over}
                        onClick={ghost ? () => setSelection(null) : () => toggle({ zone: 'circuit', index: i })}
                      />
                      <div className="tags">
                        {e.synced && <span className="tag" data-suit={e.card.suit}>Sync</span>}
                        {e.cascaded && <span className="tag" data-suit="power">Cascade</span>}
                        {e.plotted && <span className="tag" data-suit="data">Plotted</span>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <Pool game={game} view={view} />
          </div>
        </Zone>

        <div className="tray-area">
          {pending ? (
            <DecisionPanel game={game} act={run} />
          ) : (
            <Tray game={game} view={view} selection={selection} setSelection={setSelection} run={run} can={can} />
          )}
        </div>

        <Zone area="hand" title={`Hand (${game.hand.length})`}>
          <div className="hand">
            {view.hand.map((card) => (
              <CardView key={card.id} card={card} size="md" disabled={pending || over} onClick={() => setSelection({ zone: 'hand', cardId: card.id, side: 'resource' })} />
            ))}
            {view.hand.length === 0 && <p className="empty-note">Your hand is empty. End the turn to draw {perkActive(game, 'crew') ? 6 : 5}.</p>}
          </div>
        </Zone>

        <Inspector card={inspected} view={view} />
        {game.outcome && <Outcome game={game} quit={quit} />}
      </div>
    </InspectContext.Provider>
  )
}

function Zone({ area, title, note, tone, children }: { area: string; title: string; note?: string; tone?: 'danger'; children: ReactNode }) {
  return (
    <section className={`zone zone-${area}`} style={{ gridArea: area }} data-tone={tone}>
      <h2 className="zone-title">{title}</h2>
      {children}
      {note && <p className="zone-note">{note}</p>}
    </section>
  )
}

function StatusBar({ game, canUndo, undo, quit }: { game: GameState; canUndo: boolean; undo: () => void; quit: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const limit = breachLimit(game)
  return (
    <header className="status">
      <span className="wordmark">Drift Protocol</span>
      <span className="stat"><b>Turn {game.turn}</b></span>
      <span className="stat" aria-label={`${game.jumps} of 3 Jumps made`}>
        Jumps
        <span className="pips">
          {[0, 1, 2].map((i) => <span key={i} className={`pip pip-jump ${i < game.jumps ? 'is-on' : ''}`} />)}
        </span>
      </span>
      <span className="stat" aria-label={`Breach ${game.breach.length} of ${limit}`} data-tone={game.breach.length >= limit - 1 ? 'danger' : undefined}>
        Breach
        <span className="pips">
          {Array.from({ length: limit }, (_, i) => <span key={i} className={`pip pip-breach ${i < game.breach.length ? 'is-on' : ''}`} />)}
        </span>
        <b>{game.breach.length}/{limit}</b>
      </span>
      <span className="stat">Deck <b>{game.deck.length}</b></span>
      <span className="stat">Discard <b>{game.discard.length}</b></span>
      <span className="stat">Yard <b>{game.yard.length}</b></span>
      <span className="stat">Archive <b>{game.archive.length}</b></span>
      <span className="status-actions">
        <button type="button" className="btn btn-small" disabled={!canUndo} onClick={undo}>Undo</button>
        {confirming ? (
          <>
            <button type="button" className="btn btn-small btn-danger" onClick={quit}>Abandon this game</button>
            <button type="button" className="btn btn-small" onClick={() => setConfirming(false)}>Keep playing</button>
          </>
        ) : (
          <button type="button" className="btn btn-small" onClick={() => (game.outcome ? quit() : setConfirming(true))}>New game</button>
        )}
      </span>
    </header>
  )
}

function ModuleTile({ game, module: m, selection, onSelectStationed, station, stationCost }: {
  game: GameState
  module: Suit
  selection: Selection
  onSelectStationed: (cardId: string) => void
  station?: () => void
  stationCost: number
}) {
  const slot = game.modules[m]
  const online = isOnline(game, m)
  const staffed = isStaffed(game, m)
  const produced = game.turnFlags.production[m]
  const status = !online
    ? `Offline: a ${SUIT_NAME[m]} hazard is in the Threat zone`
    : staffed
      ? produced > 0 ? `Produced ${produced} ${SUIT_NAME[m]} this turn` : `Produces ${SUIT_NAME[m]} each turn`
      : `Empty: station a card here to produce ${SUIT_NAME[m]}`
  return (
    <div className="module" data-suit={m} data-online={online}>
      <div className="module-band">
        <SuitIcon suit={m} size={18} />
        <span className="module-name">{MODULE_NAME[m]}</span>
      </div>
      <div className="module-slots">
        {slot.stationed.map((card) => (
          <CardView
            key={card.id}
            card={card}
            size="xs"
            tucked
            selected={selection?.zone === 'module' && selection.cardId === card.id}
            disabled={game.pending.length > 0 || game.outcome !== null}
            onClick={() => onSelectStationed(card.id)}
          />
        ))}
        {Array.from({ length: slot.capacity - slot.stationed.length }, (_, i) => (
          <div key={i} className="empty-slot card-xs is-tucked">Open</div>
        ))}
      </div>
      <p className="module-status">{status}</p>
      <p className="module-perk" data-active={perkActive(game, m)}>{MODULE_PERK[m]}</p>
      {station && (
        <button type="button" className="btn btn-small btn-primary" onClick={station}>
          Station here for {stationCost} Crew
        </button>
      )}
    </div>
  )
}

function Course({ game, view }: { game: GameState; view: GameState }) {
  if (game.jumps >= 3) return <p className="empty-note">All three Jumps made.</p>
  const needed = JUMP_THRESHOLDS[game.jumps] + game.options.jumpBonus
  const plotted = view.circuit.filter((e) => e.plotted).map((e) => e.card)
  const committed = [...game.course, ...plotted]
  const total = committed.reduce((sum, c) => sum + c.rank, 0)
  const ready = total >= needed && SUITS.every((s) => committed.some((c) => c.suit === s))
  return (
    <div className="course">
      <div className="course-progress">
        <span className="course-total"><b>{total}</b> of {needed} rank</span>
        <span className="course-suits">
          {SUITS.map((s) => (
            <span key={s} data-have={committed.some((c) => c.suit === s)} title={SUIT_NAME[s]}>
              <SuitIcon suit={s} size={16} outline={!committed.some((c) => c.suit === s)} />
            </span>
          ))}
        </span>
      </div>
      <p className="muted">
        {ready
          ? `Ready: you Jump at the end of this turn (Jump ${game.jumps + 1}).`
          : `Jump ${game.jumps + 1} needs every suit and ${needed}+ total rank.`}
        {plotted.length > 0 && ` Includes ${plotted.length} plotted this turn.`}
      </p>
      <div className="row course-cards">
        {game.course.map((card) => <CardView key={card.id} card={card} size="xs" />)}
      </div>
    </div>
  )
}

function Pool({ game, view }: { game: GameState; view: GameState }) {
  const f = view.turnFlags
  const effects = [
    f.overdrive > 0 && `Overdrive: resource plays yield +${f.overdrive}`,
    f.patchDiscount > 0 && `Patch: neutralizing costs ${f.patchDiscount} less`,
    f.captainNext && 'Captain: your next card counts as Synced and Cascaded',
    game.logs.log2 === 'B' && 'Running silent: neutralizing costs 1 more',
  ].filter(Boolean) as string[]
  return (
    <div className="pool" aria-label="Resources this turn">
      {SUITS.map((s) => {
        const delta = view.pool[s] - game.pool[s]
        return (
          <div key={s} className="pool-row" data-suit={s} data-empty={view.pool[s] === 0}>
            <SuitIcon suit={s} size={18} />
            <span className="pool-name">{SUIT_NAME[s]}</span>
            <b className="pool-value">{view.pool[s]}</b>
            {delta > 0 && <span className="pool-delta">+{delta}</span>}
          </div>
        )
      })}
      {effects.map((e) => <p key={e} className="pool-effect">{e}</p>)}
    </div>
  )
}

function Tray({ game, view, selection, setSelection, run, can }: {
  game: GameState
  view: GameState
  selection: Selection
  setSelection: (s: Selection) => void
  run: (a: Action) => void
  can: (a: Action) => boolean
}) {
  const endTurn = <EndTurn game={game} run={run} />

  if (selection?.zone === 'hand') {
    const card = game.hand.find((c) => c.id === selection.cardId)!
    const entry = view.circuit.at(-1)!
    const gain = yieldOf(card.rank) + (entry.synced ? 1 : 0) + game.turnFlags.overdrive
    const plotFromHand: Action = { type: 'plotFromHand', cardId: card.id }
    return (
      <div className="tray">
        <div className="tray-main">
          <div className="side-choice" role="radiogroup" aria-label="Which side to play">
            <button type="button" role="radio" aria-checked={selection.side === 'resource'} onClick={() => setSelection({ ...selection, side: 'resource' })}>
              <SuitIcon suit={card.suit} size={16} /> +{gain} {SUIT_NAME[card.suit]}
            </button>
            <button type="button" role="radio" aria-checked={selection.side === 'action'} onClick={() => setSelection({ ...selection, side: 'action' })}>
              {actionName(card)}{entry.synced && ' (Sync)'}
            </button>
          </div>
          <p className="tray-note">
            {[entry.synced && 'Synced', entry.cascaded && `Cascade: +${perkActive(game, 'power') ? 2 : 1} Power`]
              .filter(Boolean)
              .join('. ') || 'No link to the previous card'}
            . Press F to turn the card, Enter to play it.
          </p>
        </div>
        <div className="tray-buttons">
          <button type="button" className="btn btn-primary" onClick={() => run({ type: 'playCard', cardId: card.id, side: selection.side })}>
            Play {selection.side === 'resource' ? `for ${SUIT_NAME[card.suit]}` : actionName(card)}
          </button>
          {can(plotFromHand) && (
            <button type="button" className="btn" onClick={() => run(plotFromHand)}>Plot from hand for 2 Data</button>
          )}
          <button type="button" className="btn" onClick={() => setSelection(null)}>Cancel</button>
        </div>
      </div>
    )
  }

  if (selection?.zone === 'rail') {
    const card = game.rail[selection.index]!
    const amount = salvageCost(game, selection.index)!
    const action: Action = { type: 'salvage', railIndex: selection.index }
    return (
      <TrayMessage
        text={`Salvage ${cardName(card)} into your discard pile for ${amount}: ${payWith(card.suit, 'salvage')}.`}
        problem={can(action) ? undefined : `You have ${game.pool[card.suit]} ${SUIT_NAME[card.suit]}${card.suit === 'power' ? '' : ` and ${game.pool.power} Power`}.`}
        buttons={[{ label: `Salvage for ${amount}`, action }]}
        run={run}
        cancel={() => setSelection(null)}
        endTurn={endTurn}
      />
    )
  }

  if (selection?.zone === 'threat') {
    const card = game.threat[selection.index]!
    const amount = neutralizeCost(game, selection.index)!
    const keep: Action = { type: 'neutralize', threatIndex: selection.index, keep: 'discard' }
    const archive: Action = { type: 'neutralize', threatIndex: selection.index, keep: 'archive' }
    return (
      <TrayMessage
        text={`Neutralize ${cardName(card)} for ${amount}: ${payWith(card.suit, 'neutralize')}. You can take it into your discard pile or archive it.`}
        problem={can(keep) ? undefined : `You have ${game.pool[card.suit]} ${SUIT_NAME[card.suit]}${card.suit === 'shields' ? '' : ` and ${game.pool.shields} Shields`}.`}
        buttons={[{ label: 'Neutralize and keep it', action: keep }, { label: 'Neutralize and archive it', action: archive }]}
        run={run}
        cancel={() => setSelection(null)}
        endTurn={endTurn}
      />
    )
  }

  if (selection?.zone === 'circuit') {
    const entry = game.circuit[selection.index]
    const action: Action = { type: 'plot', circuitIndex: selection.index }
    return (
      <TrayMessage
        text={entry.plotted ? `${cardName(entry.card)} is plotted. It goes to the Course at cleanup.` : `Plot ${cardName(entry.card)} for 2 Data. At cleanup it goes to the Course instead of your discard pile.`}
        problem={entry.plotted || can(action) ? undefined : `You have ${game.pool.data} Data.`}
        buttons={entry.plotted ? [] : [{ label: 'Plot for 2 Data', action }]}
        run={run}
        cancel={() => setSelection(null)}
        endTurn={endTurn}
      />
    )
  }

  if (selection?.zone === 'module') {
    const card = game.modules[selection.module].stationed.find((c) => c.id === selection.cardId)!
    const action: Action = { type: 'recall', module: selection.module, cardId: card.id }
    return (
      <TrayMessage
        text={`Recall ${cardName(card)} from the ${MODULE_NAME[selection.module]} to your hand. The ${MODULE_NAME[selection.module]} produces nothing this turn.`}
        problem={can(action) ? undefined : 'You can only recall before you play or spend anything this turn.'}
        buttons={[{ label: 'Recall to hand', action }]}
        run={run}
        cancel={() => setSelection(null)}
        endTurn={endTurn}
      />
    )
  }

  return (
    <div className="tray">
      <p className="tray-main tray-hint">
        {game.outcome ? 'The game is over.' : 'Choose a card in your hand to play it. Choose a Cargo Rail card to salvage it, or a hazard to neutralize it.'}
      </p>
      {!game.outcome && endTurn}
    </div>
  )
}

const payWith = (suit: Suit, kind: keyof typeof WILD) =>
  suit === WILD[kind] ? `pay ${SUIT_NAME[suit]}` : `pay ${SUIT_NAME[suit]} first, then ${SUIT_NAME[WILD[kind]]}`

function TrayMessage({ text, problem, buttons, run, cancel, endTurn }: {
  text: string
  problem?: string
  buttons: { label: string; action: Action }[]
  run: (a: Action) => void
  cancel: () => void
  endTurn: ReactNode
}) {
  return (
    <div className="tray">
      <div className="tray-main">
        <p>{text}</p>
        {problem && <p className="tray-problem">{problem}</p>}
      </div>
      <div className="tray-buttons">
        {!problem && buttons.map((b) => (
          <button key={b.label} type="button" className="btn btn-primary" onClick={() => run(b.action)}>{b.label}</button>
        ))}
        <button type="button" className="btn" onClick={cancel}>Cancel</button>
        {endTurn}
      </div>
    </div>
  )
}

function EndTurn({ game, run }: { game: GameState; run: (a: Action) => void }) {
  const hits = game.threat.length
  const limit = game.options.breachLimit + (isStaffed(game, 'shields') ? 1 : 0)
  const fatal = hits > 0 && game.breach.length + hits >= limit
  return (
    <div className="end-turn">
      {hits > 0 && (
        <span className="end-turn-warning" data-fatal={fatal}>
          {fatal ? `${hits} ${hits === 1 ? 'hazard hits' : 'hazards hit'} and the hull fails` : `${hits} ${hits === 1 ? 'hazard hits' : 'hazards hit'} at end of turn`}
        </span>
      )}
      <button type="button" className="btn btn-end" onClick={() => run({ type: 'endTurn' })}>End turn</button>
    </div>
  )
}

function Inspector({ card, view }: { card: Card | null; view: GameState }) {
  // Orientation and location come from the board as it is now, so a card turned in the Circuit
  // (or in the preview) is turned here too. Clicking turns it the other way until either changes.
  const { where, flipped: lies } = card ? locate(view, card.id) : { where: undefined, flipped: false }
  const key = `${card?.id}:${lies}`
  const [turned, setTurned] = useState(false)
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setTurned(false)
  }
  if (!card) {
    return (
      <aside className="inspector">
        <p className="empty-note">Point at any card to read it here.</p>
      </aside>
    )
  }
  const flipped = lies !== turned
  return (
    <aside className="inspector">
      <p className="inspector-where">
        <b>{cardName(card)}: {actionName(card)}</b>
        {where && <span>{where}{lies && ', played action side up'}</span>}
      </p>
      <button type="button" className="inspector-card" onClick={() => setTurned(!turned)} aria-label={`Turn ${cardName(card)} around`}>
        <img src={cardImage(card)} alt={`${cardName(card)}, ${actionName(card)}`} className={flipped ? 'is-flipped' : ''} />
      </button>
      <p className="muted">Click the card to turn it around. The dashed outline on the board marks this card.</p>
    </aside>
  )
}

function Outcome({ game, quit }: { game: GameState; quit: () => void }) {
  const o = game.outcome!
  const staffed = SUITS.filter((m) => isStaffed(game, m)).length
  return (
    <div className="outcome" role="dialog" aria-modal="true" aria-labelledby="outcome-title">
      <div className="outcome-box">
        {o.result === 'won' ? (
          <>
            <h2 id="outcome-title">Clear sky</h2>
            <p>The third Jump carried the Halcyon out of the star's pull.</p>
            <p className="score"><b>{o.score}</b> points</p>
            <p className="muted">
              {game.yard.length} left in the Salvage Yard, plus {3 * staffed} for {staffed} staffed {staffed === 1 ? 'Module' : 'Modules'}, minus {2 * game.breach.length} for {game.breach.length} Breach {game.breach.length === 1 ? 'card' : 'cards'}.
            </p>
          </>
        ) : (
          <>
            <h2 id="outcome-title">Hull lost</h2>
            <p>
              {o.reason === 'breach'
                ? `The Breach pile reached ${game.breach.length} cards and the hull failed.`
                : 'The Salvage Yard ran dry before the Cargo Rail could refill.'}
            </p>
            <p className="muted">You made {game.jumps} of 3 Jumps in {game.turn} turns.</p>
          </>
        )}
        <button type="button" className="btn btn-primary" onClick={quit}>New game</button>
      </div>
    </div>
  )
}
