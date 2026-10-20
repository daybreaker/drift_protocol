import { describe, expect, it } from 'vitest'
import { apply, IllegalActionError, previewPlay } from '../engine'
import { c, entry, filler, play, pool, state } from './helpers'

describe('resource plays', () => {
  it('adds the card yield to its suit', () => {
    const card = c('data', 8)
    const s = play(state({ hand: [card] }), card, 'resource')
    expect(s.pool).toEqual(pool({ data: 2 }))
    expect(s.hand).toEqual([])
    expect(s.circuit).toEqual([entry(card, 'resource')])
  })
})

describe('Sync', () => {
  it('a resource play after a same-suit card yields +1', () => {
    const card = c('data', 4)
    const s = play(state({ hand: [card], circuit: [entry(c('data', 9), 'action')] }), card, 'resource')
    expect(s.pool.data).toBe(2)
    expect(s.circuit[1].synced).toBe(true)
  })

  it('checks only the card directly before it', () => {
    const card = c('data', 4)
    const circuit = [entry(c('data', 9), 'resource'), entry(c('crew', 2), 'resource')]
    const s = play(state({ hand: [card], circuit }), card, 'resource')
    expect(s.circuit[2].synced).toBe(false)
  })
})

describe('Cascade', () => {
  it('a card one rank higher than the previous card gives +1 Power, either side', () => {
    const card = c('crew', 6)
    const s = play(state({ hand: [card], circuit: [entry(c('data', 5), 'action')] }), card, 'resource')
    expect(s.pool).toEqual(pool({ crew: 2, power: 1 }))
    expect(s.circuit[1].cascaded).toBe(true)
  })

  it('can Sync and Cascade at once', () => {
    const card = c('data', 5)
    const s = play(state({ hand: [card], circuit: [entry(c('data', 4), 'resource')] }), card, 'resource')
    expect(s.pool).toEqual(pool({ data: 3, power: 1 }))
  })

  it('gives 2 Power with the Reactor staffed and online', () => {
    const card = c('crew', 6)
    const modules = { ...state().modules, power: { stationed: [c('crew', 1)], capacity: 1 } }
    const s = play(state({ hand: [card], modules, circuit: [entry(c('data', 5), 'resource')] }), card, 'resource')
    expect(s.pool.power).toBe(2)
  })

  it('gives only 1 Power when a Power hazard has the Reactor offline', () => {
    const card = c('crew', 6)
    const modules = { ...state().modules, power: { stationed: [c('crew', 1)], capacity: 1 } }
    const s = play(
      state({ hand: [card], modules, threat: [c('power', 9)], circuit: [entry(c('data', 5), 'resource')] }),
      card,
      'resource',
    )
    expect(s.pool.power).toBe(1)
  })
})

describe('Captain flag', () => {
  it('makes the next card Synced and Cascaded exactly once, then clears', () => {
    const card = c('crew', 2)
    const base = state({ hand: [card], circuit: [entry(c('data', 12), 'action')] })
    const s = play({ ...base, turnFlags: { ...base.turnFlags, captainNext: true } }, card, 'resource')
    expect(s.circuit[1]).toMatchObject({ synced: true, cascaded: true })
    expect(s.pool).toEqual(pool({ crew: 2, power: 1 }))
    expect(s.turnFlags.captainNext).toBe(false)
  })
})

describe('Overdrive bonus', () => {
  it('adds +1 per Overdrive to each later resource play', () => {
    const card = c('crew', 2)
    const base = state({ hand: [card] })
    const s = play({ ...base, turnFlags: { ...base.turnFlags, overdrive: 2 } }, card, 'resource')
    expect(s.pool.crew).toBe(3)
  })
})

describe('previewPlay', () => {
  it('places the card and counts resources without resolving the action', () => {
    const recruit = c('crew', 5)
    const before = state({ hand: [recruit], deck: filler(5), circuit: [entry(c('data', 4), 'resource')] })
    const p = previewPlay(before, recruit.id, 'action')
    expect(p.circuit[1]).toMatchObject({ card: recruit, side: 'action', cascaded: true })
    expect(p.pool.power).toBe(1)
    expect(p.hand).toEqual([])
    expect(p.deck).toHaveLength(5)
    expect(p.pending).toEqual([])
  })

  it('never mutates the state it was given', () => {
    const card = c('data', 8)
    const before = state({ hand: [card] })
    const snapshot = structuredClone(before)
    previewPlay(before, card.id, 'resource')
    expect(before).toEqual(snapshot)
  })
})

describe('playCard legality', () => {
  it('rejects a card that is not in hand', () => {
    expect(() => play(state(), c('data', 8), 'resource')).toThrow(IllegalActionError)
  })

  it('rejects plays while a decision is pending', () => {
    const card = c('data', 8)
    const s = state({ hand: [card], pending: [{ kind: 'chooseResource', amount: 1 }] })
    expect(() => apply(s, { type: 'playCard', cardId: card.id, side: 'resource' })).toThrow(IllegalActionError)
  })
})
