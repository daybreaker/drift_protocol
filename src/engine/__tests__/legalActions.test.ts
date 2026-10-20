import { describe, expect, it } from 'vitest'
import { isLegal, legalActions, newGame } from '../engine'
import { c, pool, state } from './helpers'

describe('legalActions', () => {
  it('offers each hand card on both sides, plus endTurn', () => {
    const a = c('data', 8)
    const actions = legalActions(state({ hand: [a] }))
    expect(actions).toEqual(expect.arrayContaining([
      { type: 'playCard', cardId: a.id, side: 'resource' },
      { type: 'playCard', cardId: a.id, side: 'action' },
      { type: 'endTurn' },
    ]))
  })

  it('offers Salvage only for Rail cards the pool can pay for', () => {
    const rail = [c('data', 12), c('crew', 6), null, null, null]
    const actions = legalActions(state({ rail, pool: pool({ data: 3 }) }))
    expect(actions).toContainEqual({ type: 'salvage', railIndex: 0 })
    expect(actions).not.toContainEqual({ type: 'salvage', railIndex: 1 })
  })

  it('offers nothing but resolving while a decision is pending', () => {
    const s = state({ hand: [c('data', 8)], pending: [{ kind: 'chooseResource', amount: 1 }] })
    expect(legalActions(s).every((a) => a.type === 'resolve')).toBe(true)
  })

  it('offers nothing once the game is over', () => {
    expect(legalActions(state({ hand: [c('data', 8)], outcome: { result: 'lost', reason: 'breach' } }))).toEqual([])
  })

  it('isLegal agrees with the listed actions', () => {
    const s = newGame({ seed: 3 })
    expect(legalActions(s).every((a) => isLegal(s, a))).toBe(true)
    expect(isLegal(s, { type: 'plot', circuitIndex: 0 })).toBe(false)
  })
})
