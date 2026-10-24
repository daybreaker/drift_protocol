import { SUITS, type Asteroid, type Card, type Suit } from './types'

export const ACTION_NAMES: Record<number, string> = {
  1: 'Scrounge',
  2: 'Patch',
  3: 'Scan',
  4: 'Jettison',
  5: 'Recruit',
  6: 'Tractor Beam',
  7: 'Dock',
  8: 'Relay',
  9: 'Overdrive',
  10: 'Engineer',
  11: 'Navigator',
  12: 'Captain',
}

/** Total Course rank needed for Jumps 1–3 (Ruling 19 raised Jump 1 from 11). */
export const JUMP_THRESHOLDS = [14, 20, 30] as const

export function cost(rank: number): number {
  if (rank <= 4) return 2
  if (rank <= 8) return 3
  return 5
}

export function yieldOf(rank: number): number {
  if (rank <= 4) return 1
  if (rank <= 8) return 2
  return 3
}

export function makeCard(suit: Suit, rank: number): Card {
  return { id: `${suit}-${String(rank).padStart(2, '0')}`, suit, rank }
}

/** Neutralizing an Asteroid costs 5, in Shields only (Ruling 20). */
export const ASTEROID_COST = 5

export function makeAsteroid(n: 1 | 2): Asteroid {
  return { id: `asteroid-${n}`, kind: 'asteroid' }
}

/** All 48 numbered cards, ordered by suit then rank. */
export function fullDeck(): Card[] {
  return SUITS.flatMap((suit) => Array.from({ length: 12 }, (_, i) => makeCard(suit, i + 1)))
}
