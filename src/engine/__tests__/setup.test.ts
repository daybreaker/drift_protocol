import { describe, expect, it } from 'vitest'
import { newGame } from '../engine'
import type { Card, GameState } from '../types'

const allCards = (s: GameState): Card[] => [
  ...s.deck, ...s.hand, ...s.discard, ...s.yard, ...s.threat, ...s.breach, ...s.course, ...s.archive,
  ...s.circuit.map((e) => e.card),
  ...s.rail.filter((c): c is Card => c !== null),
  ...Object.values(s.modules).flatMap((m) => m.stationed),
]

describe('newGame (Standard)', () => {
  const s = newGame({ seed: 7 })

  it('builds a 10-card starting deck: all 1s, all 2s, and the Power and Shields 3s', () => {
    const start = [...s.deck, ...s.hand].map((c) => c.id).sort()
    expect(start).toEqual([
      'crew-01', 'crew-02', 'data-01', 'data-02', 'power-01', 'power-02', 'power-03',
      'shields-01', 'shields-02', 'shields-03',
    ])
  })

  it('draws a hand of 5', () => {
    expect(s.hand).toHaveLength(5)
    expect(s.deck).toHaveLength(5)
  })

  it('fills the Cargo Rail with 5 cards and leaves 33 in the Yard', () => {
    expect(s.rail.every((c) => c !== null)).toBe(true)
    expect(s.yard).toHaveLength(33)
  })

  it('accounts for all 48 cards exactly once', () => {
    const ids = allCards(s).map((c) => c.id)
    expect(ids).toHaveLength(48)
    expect(new Set(ids).size).toBe(48)
  })

  it('starts calm, on turn 1, with an empty pool and no outcome', () => {
    expect(s.calm).toBe(true)
    expect(s.turn).toBe(1)
    expect(s.pool).toEqual({ power: 0, crew: 0, data: 0, shields: 0 })
    expect(s.outcome).toBeNull()
    expect(s.options).toEqual({ breachLimit: 5, jumpBonus: 0 })
  })

  it('is reproducible from its seed', () => {
    expect(newGame({ seed: 7 })).toEqual(s)
    expect(newGame({ seed: 8 })).not.toEqual(s)
  })
})

describe('newGame options', () => {
  it('lets the player pick the two starting 3s', () => {
    const s = newGame({ seed: 1, startingThrees: ['data', 'crew'] })
    const threes = [...s.deck, ...s.hand].filter((c) => c.rank === 3).map((c) => c.id).sort()
    expect(threes).toEqual(['crew-03', 'data-03'])
  })

  it('Cadet starts with all four 3s and a Breach limit of 6', () => {
    const s = newGame({ seed: 1, difficulty: 'cadet' })
    expect([...s.deck, ...s.hand]).toHaveLength(12)
    expect(s.yard).toHaveLength(31)
    expect(s.options.breachLimit).toBe(6)
  })

  it('Veteran has a Breach limit of 4 and Jumps need +5 rank', () => {
    const s = newGame({ seed: 1, difficulty: 'veteran' })
    expect(s.options).toEqual({ breachLimit: 4, jumpBonus: 5 })
  })
})
