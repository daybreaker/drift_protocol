import { makeCard } from '../cards'
import { apply, emptyState } from '../engine'
import type { Card, CircuitEntry, DecisionChoice, GameState, Side, Suit } from '../types'

export const c = (suit: Suit, rank: number): Card => makeCard(suit, rank)

export function state(overrides: Partial<GameState> = {}): GameState {
  return { ...emptyState(), ...overrides }
}

export function entry(card: Card, side: Side, extra: Partial<CircuitEntry> = {}): CircuitEntry {
  return { card, side, synced: false, cascaded: false, plotted: false, ...extra }
}

export function play(s: GameState, card: Card, side: Side): GameState {
  return apply(s, { type: 'playCard', cardId: card.id, side })
}

export function resolve(s: GameState, choice: DecisionChoice): GameState {
  return apply(s, { type: 'resolve', choice })
}

export const pool = (p: Partial<Record<Suit, number>> = {}) => ({ power: 0, crew: 0, data: 0, shields: 0, ...p })

/** Cards that only fill space; rank 1 Crew cards with unique ids. */
export function filler(n: number, suit: Suit = 'crew'): Card[] {
  return Array.from({ length: n }, (_, i) => ({ id: `filler-${suit}-${i}`, suit, rank: 1 }))
}
