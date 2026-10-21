import { salvageCost, type Action, type Card, type GameState, type Side } from '../engine'
import { locate } from './locate'
import { costLine, playLabel } from './payment'
import { actionName, cardImage, cardName } from './text'
import type { Preview } from './Tray'

interface Props {
  card: Card | null
  game: GameState
  view: GameState
  preview: Preview | null
  setPreview: (p: Preview | null) => void
  /** Whether the inspector shows the card action side up. */
  flipped: boolean
  /** Turn the card: switches the side to play while it is the tentative play. */
  turn: () => void
  handSide: (card: Card) => Side
  run: (a: Action) => void
  can: (a: Action) => boolean
}

export function Inspector({ card, game, view, preview, setPreview, flipped, turn, handSide, run, can }: Props) {
  if (!card) {
    return (
      <aside className="inspector">
        <p className="empty-note">Click any card to read it here. Click it again to turn it around.</p>
      </aside>
    )
  }
  const { where } = locate(view, card.id)
  const previewing = preview?.cardId === card.id ? preview : null

  return (
    <aside className="inspector">
      <p className="inspector-where">
        <b>{cardName(card)}: {actionName(card)}</b>
        {where && <span>{where}{previewing && ', not played yet'}</span>}
      </p>
      <button type="button" className="inspector-card" onClick={turn} aria-label={previewing ? `Play the other side of ${cardName(card)}` : `Turn ${cardName(card)} around`}>
        <img src={cardImage(card)} alt={`${cardName(card)}, ${actionName(card)}`} className={flipped ? 'is-flipped' : ''} />
      </button>
      <InspectorActions card={card} game={game} previewing={previewing} setPreview={setPreview} handSide={handSide} run={run} can={can} />
      <p className="muted">{previewing ? 'Click the card to play its other side.' : 'Click the card here or on the board to turn it around.'}</p>
    </aside>
  )
}

function InspectorActions({ card, game, previewing, setPreview, handSide, run, can }: {
  card: Card
  game: GameState
  previewing: Preview | null
  setPreview: (p: Preview | null) => void
  handSide: (card: Card) => Side
  run: (a: Action) => void
  can: (a: Action) => boolean
}) {
  const blocked = game.pending.length > 0 || game.outcome !== null

  if (previewing) {
    return (
      <div className="inspector-actions">
        <button type="button" className="btn btn-primary" onClick={() => run({ type: 'playCard', cardId: card.id, side: previewing.side })}>
          {playLabel(card, previewing.side)}
        </button>
        <button type="button" className="btn" onClick={() => setPreview(null)}>Cancel</button>
      </div>
    )
  }

  if (game.hand.some((c) => c.id === card.id)) {
    return (
      <div className="inspector-actions">
        <button type="button" className="btn btn-primary" disabled={blocked} onClick={() => setPreview({ cardId: card.id, side: handSide(card) })}>
          Add to Circuit
        </button>
      </div>
    )
  }

  const railIndex = game.rail.findIndex((c) => c?.id === card.id)
  if (railIndex >= 0) {
    const action: Action = { type: 'salvage', railIndex }
    const amount = salvageCost(game, railIndex)!
    const pay = costLine(game, amount, card.suit, 'salvage')
    return (
      <div className="inspector-actions">
        <button type="button" className="btn btn-primary" disabled={!can(action)} onClick={() => run(action)}>
          Salvage for {amount}
        </button>
        {!blocked && <p className={pay.ok ? 'inspector-note' : 'inspector-problem'}>{pay.text}</p>}
      </div>
    )
  }

  return null
}
