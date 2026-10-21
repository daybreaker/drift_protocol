import type { ReactNode } from 'react'
import { cost, isStaffed, neutralizeCost, perkActive, salvageCost, SUITS, yieldOf, type Action, type Card, type GameState, type Side } from '../engine'
import { SuitIcon } from './Card'
import { costLine, describePayment, playLabel, youHave } from './payment'
import { actionName, cardName, listAmounts, MODULE_NAME, SUIT_NAME, WILD } from './text'

export interface Preview {
  cardId: string
  side: Side
}

interface Props {
  game: GameState
  view: GameState
  inspectedId: string | null
  preview: Preview | null
  setPreview: (p: Preview | null) => void
  /** The side a hand card would be played on: the way it currently faces in the hand. */
  handSide: (card: Card) => Side
  run: (a: Action) => void
  can: (a: Action) => boolean
}

/** What the inspected card (or the tentative play) can do right now. */
export function Tray({ game, view, inspectedId, preview, setPreview, handSide, run, can }: Props) {
  const endTurn = <EndTurn game={game} run={run} />

  if (preview) {
    const card = game.hand.find((c) => c.id === preview.cardId)!
    const entry = view.circuit.at(-1)!
    const gain = yieldOf(card.rank) + (entry.synced ? 1 : 0) + game.turnFlags.overdrive
    const plotFromHand: Action = { type: 'plotFromHand', cardId: card.id }
    const links = [entry.synced && 'Synced', entry.cascaded && `Cascade: +${perkActive(game, 'power') ? 2 : 1} Power`].filter(Boolean).join('. ')
    const gains = listAmounts(Object.fromEntries(SUITS.map((s) => [s, view.pool[s] - game.pool[s]])))
    return (
      <div className="tray">
        <div className="tray-main">
          <div className="side-choice" role="radiogroup" aria-label="Which side to play">
            <button type="button" role="radio" aria-checked={preview.side === 'action'} onClick={() => setPreview({ ...preview, side: 'action' })}>
              {actionName(card)}{entry.synced && ' (Sync)'}
            </button>
            <button type="button" role="radio" aria-checked={preview.side === 'resource'} onClick={() => setPreview({ ...preview, side: 'resource' })}>
              <SuitIcon suit={card.suit} size={16} /> +{gain} {SUIT_NAME[card.suit]}
            </button>
          </div>
          <p className="tray-note">
            {gains ? `Gains ${gains} in all. ` : 'Gains no resources. '}
            {links || 'No link to the previous card'}. Press F to turn the card, Enter to play it.
          </p>
        </div>
        <div className="tray-buttons">
          <button type="button" className="btn btn-primary" onClick={() => run({ type: 'playCard', cardId: card.id, side: preview.side })}>
            {playLabel(card, preview.side)}
          </button>
          {can(plotFromHand) && <button type="button" className="btn" onClick={() => run(plotFromHand)}>Plot from hand for {cost(card.rank)} Data</button>}
          <button type="button" className="btn" onClick={() => setPreview(null)}>Cancel</button>
        </div>
      </div>
    )
  }

  const id = inspectedId
  const handCard = game.hand.find((c) => c.id === id)
  if (handCard) {
    const side = handSide(handCard)
    const plotFromHand: Action = { type: 'plotFromHand', cardId: handCard.id }
    const stationable = SUITS.some((m) => can({ type: 'station', cardId: handCard.id, module: m }))
    return (
      <TrayMessage
        text={`${cardName(handCard)} is in your hand, ${side === 'action' ? `action side up (${actionName(handCard)})` : `resource side up (${SUIT_NAME[handCard.suit]})`}. Click it again to turn it.`}
        note={stationable ? 'You can also station it at a Module.' : undefined}
        buttons={[
          { label: 'Add to Circuit', onClick: () => setPreview({ cardId: handCard.id, side }), disabled: !can({ type: 'playCard', cardId: handCard.id, side }) },
          ...(can(plotFromHand) ? [{ label: `Plot from hand for ${cost(handCard.rank)} Data`, onClick: () => run(plotFromHand), secondary: true }] : []),
        ]}
        endTurn={endTurn}
      />
    )
  }

  const railIndex = game.rail.findIndex((c) => c?.id === id)
  if (railIndex >= 0) {
    const card = game.rail[railIndex]!
    const amount = salvageCost(game, railIndex)!
    const action: Action = { type: 'salvage', railIndex }
    const pay = costLine(game, amount, card.suit, 'salvage')
    return (
      <TrayMessage
        text={`Salvage ${cardName(card)} into your discard pile for ${amount}.`}
        note={pay.ok ? pay.text : undefined}
        problem={pay.ok ? undefined : pay.text}
        buttons={[{ label: `Salvage for ${amount}`, onClick: () => run(action), disabled: !can(action) }]}
        endTurn={endTurn}
      />
    )
  }

  const threatIndex = game.threat.findIndex((c) => c.id === id)
  if (threatIndex >= 0) {
    const card = game.threat[threatIndex]
    const archiveCost = neutralizeCost(game, threatIndex, 'archive')!
    const keepCost = neutralizeCost(game, threatIndex, 'discard')!
    const keep: Action = { type: 'neutralize', threatIndex, keep: 'discard' }
    const archive: Action = { type: 'neutralize', threatIndex, keep: 'archive' }
    const payArchive = describePayment(game.pool, archiveCost, card.suit, WILD.neutralize)
    const payKeep = describePayment(game.pool, keepCost, card.suit, WILD.neutralize)
    return (
      <TrayMessage
        text={`Neutralize ${cardName(card)} for ${archiveCost} to archive it, or ${keepCost} to keep it in your discard pile.`}
        note={payArchive ? `Archiving pays ${payArchive}. ${payKeep ? `Keeping pays ${payKeep}.` : 'You cannot afford to keep it.'}` : undefined}
        problem={payArchive ? undefined : youHave(game, card.suit, 'neutralize')}
        buttons={[
          { label: `Neutralize and archive it (${archiveCost})`, onClick: () => run(archive), disabled: !can(archive) },
          { label: `Neutralize and keep it (${keepCost})`, onClick: () => run(keep), disabled: !can(keep), secondary: true },
        ]}
        endTurn={endTurn}
      />
    )
  }

  const circuitIndex = game.circuit.findIndex((e) => e.card.id === id)
  if (circuitIndex >= 0) {
    const entry = game.circuit[circuitIndex]
    const action: Action = { type: 'plot', circuitIndex }
    return (
      <TrayMessage
        text={entry.plotted ? `${cardName(entry.card)} is plotted. It goes to the Course at cleanup.` : `Plot ${cardName(entry.card)} for ${cost(entry.card.rank)} Data. At cleanup it goes to the Course instead of your discard pile.`}
        problem={entry.plotted || can(action) ? undefined : `You have ${game.pool.data} Data.`}
        buttons={entry.plotted ? [] : [{ label: `Plot for ${cost(entry.card.rank)} Data`, onClick: () => run(action), disabled: !can(action) }]}
        endTurn={endTurn}
      />
    )
  }

  const module = SUITS.find((m) => game.modules[m].stationed.some((c) => c.id === id))
  if (module) {
    const card = game.modules[module].stationed.find((c) => c.id === id)!
    const action: Action = { type: 'recall', module, cardId: card.id }
    return (
      <TrayMessage
        text={`Recall ${cardName(card)} from the ${MODULE_NAME[module]} to your hand. The ${MODULE_NAME[module]} produces nothing this turn.`}
        problem={can(action) ? undefined : 'You can only recall before you play or spend anything this turn.'}
        buttons={[{ label: 'Recall to hand', onClick: () => run(action), disabled: !can(action) }]}
        endTurn={endTurn}
      />
    )
  }

  return (
    <div className="tray">
      <p className="tray-main tray-hint">
        {game.outcome ? 'The game is over.' : 'Click a card to inspect it. Its actions appear here: play from your hand, salvage from the Cargo Rail, or neutralize a hazard.'}
      </p>
      {!game.outcome && endTurn}
    </div>
  )
}

function TrayMessage({ text, note, problem, buttons, endTurn }: {
  text: string
  note?: string
  problem?: string
  buttons: { label: string; onClick: () => void; disabled?: boolean; secondary?: boolean }[]
  endTurn: ReactNode
}) {
  return (
    <div className="tray">
      <div className="tray-main">
        <p>{text}</p>
        {note && <p className="tray-note">{note}</p>}
        {problem && <p className="tray-problem">{problem}</p>}
      </div>
      <div className="tray-buttons">
        {buttons.map((b) => (
          <button key={b.label} type="button" className={b.secondary ? 'btn' : 'btn btn-primary'} disabled={b.disabled} onClick={b.onClick}>
            {b.label}
          </button>
        ))}
        {endTurn}
      </div>
    </div>
  )
}

function EndTurn({ game, run }: { game: GameState; run: (a: Action) => void }) {
  const hits = game.threat.length
  // Ruling 16: the Shield Array's +1 counts once the hazards have moved, so only staffing matters here.
  const limit = game.options.breachLimit + (isStaffed(game, 'shields') ? 1 : 0)
  const fatal = hits > 0 && game.breach.length + hits >= limit
  const many = hits === 1 ? 'hazard hits' : 'hazards hit'
  return (
    <div className="end-turn">
      {hits > 0 && (
        <span className="end-turn-warning" data-fatal={fatal}>
          {fatal ? `${hits} ${many} and the hull fails` : `${hits} ${many} at end of turn`}
        </span>
      )}
      <button type="button" className="btn btn-end" disabled={game.pending.length > 0} onClick={() => run({ type: 'endTurn' })}>
        End turn
      </button>
    </div>
  )
}
