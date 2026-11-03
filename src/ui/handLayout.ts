import type { Card } from '../engine'

/** A place in the hand row. A card that has left keeps its place briefly ('hold'), then the gap closes ('close'). */
export interface Slot {
  card: Card
  leaving?: 'hold' | 'close'
}

/** The hand in the player's chosen order. Cards not in `order` (newly drawn) go at the end, in draw order. */
export function orderHand(hand: Card[], order: string[]): Card[] {
  const rank = (c: Card) => {
    const i = order.indexOf(c.id)
    return i === -1 ? Infinity : i
  }
  return [...hand].sort((x, y) => rank(x) - rank(y))
}

/**
 * Updates the row for a new hand. Departed cards become gaps where they were, cards still (or again)
 * in hand fill the remaining places in `cards` order, and new cards are appended.
 */
export function reconcileSlots(slots: Slot[], cards: Card[]): Slot[] {
  const inHand = new Set(cards.map((c) => c.id))
  const known = new Set(slots.map((s) => s.card.id))
  const queue = cards.filter((c) => known.has(c.id))
  const kept = slots.map((s): Slot => (inHand.has(s.card.id) ? { card: queue.shift()! } : { card: s.card, leaving: s.leaving ?? 'hold' }))
  return [...kept, ...cards.filter((c) => !known.has(c.id)).map((card) => ({ card }))]
}

export function moveId(ids: string[], id: string, to: number): string[] {
  const rest = ids.filter((x) => x !== id)
  return [...rest.slice(0, to), id, ...rest.slice(to)]
}

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** How far above the hand row a dragged card still rearranges the hand. */
const HAND_MARGIN = 40

const inside = (p: { x: number; y: number }, b: Box) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom

/** What a card dragged out of the hand is over: the hand (rearrange), the Circuit (add it there) or neither. */
export function dropTarget(p: { x: number; y: number }, hand: Box, circuit: Box | null): 'hand' | 'circuit' | 'none' {
  // Read each side explicitly: a DOMRect's sides are getters, so spreading one copies nothing.
  if (inside(p, { left: hand.left, top: hand.top - HAND_MARGIN, right: hand.right, bottom: hand.bottom })) return 'hand'
  if (circuit && inside(p, circuit)) return 'circuit'
  return 'none'
}
