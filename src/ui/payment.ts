import type { Card, GameState, Pool, Side, Suit } from '../engine'
import { actionName, SUIT_NAME, WILD } from './text'

/** How auto-pay would cover `amount`: exact suit first, then the wild. Null when the pool cannot pay. */
export function describePayment(pool: Pool, amount: number, suit: Suit, wild: Suit): string | null {
  if (amount === 0) return 'nothing'
  const fromSuit = Math.min(pool[suit], amount)
  const fromWild = suit === wild ? 0 : amount - fromSuit
  if (fromSuit + fromWild < amount || pool[wild] < fromWild) return null
  return [fromSuit > 0 && `${fromSuit} ${SUIT_NAME[suit]}`, fromWild > 0 && `${fromWild} ${SUIT_NAME[wild]}`].filter(Boolean).join(' + ')
}

/** What the pool holds toward a cost: the exact suit and, if different, the wild. */
export const youHave = (game: GameState, suit: Suit, kind: keyof typeof WILD) =>
  `You have ${game.pool[suit]} ${SUIT_NAME[suit]}${suit === WILD[kind] ? '' : ` and ${game.pool[WILD[kind]]} ${SUIT_NAME[WILD[kind]]}`}.`

/** "pays 1 Power + 4 Shields" when affordable, otherwise what the pool holds. */
export function costLine(game: GameState, amount: number, suit: Suit, kind: keyof typeof WILD): { ok: boolean; text: string } {
  const pays = describePayment(game.pool, amount, suit, WILD[kind])
  return pays ? { ok: true, text: `Pays ${pays}.` } : { ok: false, text: youHave(game, suit, kind) }
}

export const playLabel = (card: Card, side: Side) => `Play ${side === 'resource' ? `for ${SUIT_NAME[card.suit]}` : actionName(card)}`
