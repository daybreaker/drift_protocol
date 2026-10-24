import { describe, expect, it } from 'vitest'
import { apply, legalActions, newGame } from '../engine'
import { nextRandom } from '../rng'
import type { Action, FieldCard, GameState } from '../types'

const allIds = (s: GameState): string[] => [
  ...s.deck, ...s.hand, ...s.discard, ...s.yard, ...s.threat, ...s.breach, ...s.course, ...s.archive,
  ...s.circuit.map((e) => e.card),
  ...s.rail.filter((c): c is FieldCard => c !== null),
  ...Object.values(s.modules).flatMap((m) => m.stationed),
].map((c) => c.id)

// Greedy bot: answer decisions, then spend (neutralize, plot, salvage, station), then play, then end the turn.
// Ties are broken at random, so different seeds explore different games.
const PRIORITY: Action['type'][] = ['resolve', 'neutralize', 'plot', 'salvage', 'station', 'playCard', 'endTurn']

function botGame(seed: number, maxSteps = 2000): GameState[] {
  let s = newGame({ seed })
  let r = seed
  const states = [s]
  for (let step = 0; step < maxSteps && !s.outcome; step++) {
    const actions = legalActions(s)
    const type = PRIORITY.find((t) => actions.some((a) => a.type === t))!
    const options = actions.filter((a) => a.type === type)
    let x: number
    ;[x, r] = nextRandom(r)
    const snapshot = structuredClone(s)
    s = apply(s, options[Math.floor(x * options.length)])
    expect(states.at(-1)).toEqual(snapshot)
    states.push(s)
  }
  return states
}

describe('bot playthroughs', () => {
  it.each(Array.from({ length: 20 }, (_, i) => i + 1))('seed %i: every listed action applies, inputs are untouched, all 50 cards stay accounted for', (seed) => {
    const states = botGame(seed)
    expect(states.at(-1)!.outcome).not.toBeNull()
    for (const s of states) {
      const ids = allIds(s)
      expect(ids).toHaveLength(50)
      expect(new Set(ids).size).toBe(50)
      expect(Object.values(s.pool).every((n) => n >= 0)).toBe(true)
    }
  })

  it('replays exactly from a seed', () => {
    expect(botGame(42)).toEqual(botGame(42))
  })
})
