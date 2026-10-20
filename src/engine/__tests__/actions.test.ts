import { describe, expect, it } from 'vitest'
import { apply, IllegalActionError } from '../engine'
import type { GameState } from '../types'
import { c, entry, filler, play, pool, resolve, state } from './helpers'

const withFlags = (s: GameState, flags: Partial<GameState['turnFlags']>): GameState => ({
  ...s,
  turnFlags: { ...s.turnFlags, ...flags },
})

describe('1 Scrounge', () => {
  it('asks for a resource and gains 1 of it', () => {
    const card = c('crew', 1)
    const s = play(state({ hand: [card] }), card, 'action')
    expect(s.pending).toEqual([{ kind: 'chooseResource', amount: 1 }])
    expect(resolve(s, { kind: 'chooseResource', suit: 'data' }).pool).toEqual(pool({ data: 1 }))
  })

  it('Sync: gains 2 of one resource', () => {
    const card = c('crew', 1)
    const s = play(state({ hand: [card], circuit: [entry(c('crew', 9), 'resource')] }), card, 'action')
    expect(s.pending).toEqual([{ kind: 'chooseResource', amount: 2 }])
  })
})

describe('2 Patch', () => {
  it('makes neutralizing cost 2 less this turn', () => {
    const card = c('data', 2)
    let s = play(state({ hand: [card], threat: [c('crew', 9)], pool: pool({ shields: 3 }) }), card, 'action')
    expect(s.turnFlags.patchDiscount).toBe(2)
    s = apply(s, { type: 'neutralize', threatIndex: 0, keep: 'archive' })
    expect(s.pool.shields).toBe(0)
  })

  it('Sync: also moves the top Breach card to the bottom of the Yard', () => {
    const card = c('data', 2)
    const s = play(
      state({ hand: [card], circuit: [entry(c('data', 7), 'resource')], breach: [c('crew', 9), c('power', 6)], yard: [c('crew', 3)] }),
      card,
      'action',
    )
    expect(s.breach.map((x) => x.id)).toEqual(['crew-09'])
    expect(s.yard.map((x) => x.id)).toEqual(['crew-03', 'power-06'])
  })
})

describe('3 Scan', () => {
  it('shows the top 3, then discards and reorders as chosen', () => {
    const card = c('crew', 3)
    const [a, b, d, e] = [c('data', 1), c('data', 2), c('data', 3), c('data', 4)]
    let s = play(state({ hand: [card], deck: [a, b, d, e] }), card, 'action')
    expect(s.pending).toEqual([{ kind: 'scan', cards: [a, b, d], drawAfter: false }])
    s = resolve(s, { kind: 'scan', discard: [b.id], order: [d.id, a.id] })
    expect(s.deck.map((x) => x.id)).toEqual([d.id, a.id, e.id])
    expect(s.discard.map((x) => x.id)).toContain(b.id)
  })

  it('looks at fewer cards when the deck is short, without reshuffling', () => {
    const card = c('crew', 3)
    const s = play(state({ hand: [card], deck: [c('data', 1)], discard: filler(4) }), card, 'action')
    expect(s.pending).toEqual([{ kind: 'scan', cards: [c('data', 1)], drawAfter: false }])
  })

  it('Sync: draws 1 after reordering', () => {
    const card = c('crew', 3)
    const [a, b] = [c('data', 1), c('data', 2)]
    let s = play(state({ hand: [card], deck: [a, b], circuit: [entry(c('crew', 8), 'resource')] }), card, 'action')
    s = resolve(s, { kind: 'scan', discard: [], order: [b.id, a.id] })
    expect(s.hand.map((x) => x.id)).toEqual([b.id])
  })
})

describe('4 Jettison', () => {
  it('Archives 1 chosen card from hand or discard and gains 1 Power', () => {
    const card = c('crew', 4)
    const junk = c('data', 1)
    let s = play(state({ hand: [card, junk] }), card, 'action')
    expect(s.pending).toEqual([{ kind: 'chooseCards', purpose: 'jettison', max: 1 }])
    s = resolve(s, { kind: 'chooseCards', cardIds: [junk.id] })
    expect(s.archive).toEqual([junk])
    expect(s.pool.power).toBe(1)
  })

  it('may Archive nothing', () => {
    const card = c('crew', 4)
    const s = resolve(play(state({ hand: [card] }), card, 'action'), { kind: 'chooseCards', cardIds: [] })
    expect(s.pool.power).toBe(0)
  })

  it('rejects more cards than allowed', () => {
    const card = c('crew', 4)
    const s = play(state({ hand: [card], discard: [c('data', 1), c('data', 2)] }), card, 'action')
    expect(() => resolve(s, { kind: 'chooseCards', cardIds: ['data-01', 'data-02'] })).toThrow(IllegalActionError)
  })

  it('Sync: up to 2 cards, 1 Power each', () => {
    const card = c('crew', 4)
    let s = play(state({ hand: [card], discard: [c('data', 1), c('data', 2)], circuit: [entry(c('crew', 9), 'resource')] }), card, 'action')
    s = resolve(s, { kind: 'chooseCards', cardIds: ['data-01', 'data-02'] })
    expect(s.pool.power).toBe(2)
    expect(s.archive).toHaveLength(2)
  })
})

describe('5 Recruit', () => {
  it('draws 2', () => {
    const card = c('crew', 5)
    const s = play(state({ hand: [card], deck: filler(3) }), card, 'action')
    expect(s.hand).toHaveLength(2)
    expect(s.deck).toHaveLength(1)
  })

  it('Sync: draws 3', () => {
    const card = c('crew', 5)
    const s = play(state({ hand: [card], deck: filler(3), circuit: [entry(c('crew', 9), 'resource')] }), card, 'action')
    expect(s.hand).toHaveLength(3)
  })

  it('reshuffles the discard when the deck runs out, which ends calm start', () => {
    const card = c('crew', 5)
    const s = play(state({ hand: [card], deck: filler(1), discard: filler(3, 'data') }), card, 'action')
    expect(s.hand).toHaveLength(2)
    expect(s.discard).toHaveLength(0)
    expect(s.deck).toHaveLength(2)
    expect(s.calm).toBe(false)
  })
})

describe('6 Tractor Beam', () => {
  const rail = [c('data', 12), c('crew', 6), null, null, null]

  it('salvages a Rail card for 2 less, stacking with the Airlock discount, onto the deck', () => {
    const card = c('power', 6)
    let s = play(state({ hand: [card], rail, deck: filler(2), pool: pool({ data: 1 }) }), card, 'action')
    expect(s.pending).toEqual([{ kind: 'tractorBeam', toHand: false }])
    s = resolve(s, { kind: 'tractorBeam', railIndex: 0 })
    expect(s.deck[0].id).toBe('data-12')
    expect(s.rail[0]).toBeNull()
    expect(s.pool.data).toBe(0)
    expect(s.turnFlags.salvagedAirlock).toBe(true)
  })

  it('costs nothing below 0', () => {
    const card = c('power', 6)
    let s = play(state({ hand: [card], rail }), card, 'action')
    s = resolve(s, { kind: 'tractorBeam', railIndex: 1 })
    expect(s.deck[0].id).toBe('crew-06')
  })

  it('may be declined', () => {
    const card = c('power', 6)
    const s = resolve(play(state({ hand: [card], rail }), card, 'action'), { kind: 'tractorBeam', railIndex: null })
    expect(s.rail[0]?.id).toBe('data-12')
  })

  it('Sync: the salvaged card goes to hand', () => {
    const card = c('power', 6)
    let s = play(state({ hand: [card], rail, pool: pool({ power: 1 }), circuit: [entry(c('power', 2), 'resource')] }), card, 'action')
    s = resolve(s, { kind: 'tractorBeam', railIndex: 0 })
    expect(s.hand.map((x) => x.id)).toEqual(['data-12'])
  })
})

describe('7 Dock', () => {
  it('stations a card from hand for free', () => {
    const card = c('crew', 7)
    const worker = c('data', 9)
    let s = play(state({ hand: [card, worker] }), card, 'action')
    s = resolve(s, { kind: 'dock', cardId: worker.id, module: 'data' })
    expect(s.modules.data.stationed).toEqual([worker])
    expect(s.pool).toEqual(pool())
  })

  it('Sync: that Module produces right now', () => {
    const card = c('crew', 7)
    const worker = c('data', 9)
    let s = play(state({ hand: [card, worker], circuit: [entry(c('crew', 2), 'resource')] }), card, 'action')
    s = resolve(s, { kind: 'dock', cardId: worker.id, module: 'data' })
    expect(s.pool.data).toBe(4)
  })
})

describe('8 Relay', () => {
  it('repeats the printed yield of a previous resource-side card', () => {
    const card = c('power', 8)
    const s = play(state({ hand: [card], circuit: [entry(c('data', 9), 'resource')] }), card, 'action')
    expect(s.pool.data).toBe(3)
  })

  it('gains nothing after an action-side card', () => {
    const card = c('power', 8)
    const s = play(state({ hand: [card], circuit: [entry(c('data', 9), 'action')] }), card, 'action')
    expect(s.pool).toEqual(pool())
  })

  it('is not boosted by Overdrive', () => {
    const card = c('power', 8)
    const s = play(withFlags(state({ hand: [card], circuit: [entry(c('data', 9), 'resource')] }), { overdrive: 1 }), card, 'action')
    expect(s.pool.data).toBe(3)
  })

  it('Sync: +1 to that', () => {
    const card = c('data', 8)
    const s = play(state({ hand: [card], circuit: [entry(c('data', 5), 'resource')] }), card, 'action')
    expect(s.pool.data).toBe(3)
  })
})

describe('9 Overdrive', () => {
  it('boosts later resource plays by 1', () => {
    const card = c('power', 9)
    const next = c('crew', 2)
    let s = play(state({ hand: [card, next] }), card, 'action')
    expect(s.turnFlags.overdrive).toBe(1)
    s = play(s, next, 'resource')
    expect(s.pool.crew).toBe(2)
  })

  it('Sync: also draws 1', () => {
    const card = c('power', 9)
    const s = play(state({ hand: [card], deck: filler(1), circuit: [entry(c('power', 2), 'resource')] }), card, 'action')
    expect(s.hand).toHaveLength(1)
  })
})

describe('10 Engineer', () => {
  it('copies the base action of a chosen Circuit card', () => {
    const card = c('shields', 10)
    let s = play(state({ hand: [card], deck: filler(5), circuit: [entry(c('crew', 5), 'action')] }), card, 'action')
    expect(s.pending).toEqual([{ kind: 'engineer', sync: false, engineerIndex: 1 }])
    s = resolve(s, { kind: 'engineer', circuitIndex: 0 })
    expect(s.hand).toHaveLength(2)
  })

  it('Sync: copies the Sync effect', () => {
    const card = c('crew', 10)
    let s = play(state({ hand: [card], deck: filler(5), circuit: [entry(c('crew', 5), 'action')] }), card, 'action')
    s = resolve(s, { kind: 'engineer', circuitIndex: 0 })
    expect(s.hand).toHaveLength(3)
  })

  it('cannot copy another Engineer', () => {
    const card = c('crew', 10)
    const s = play(state({ hand: [card], circuit: [entry(c('data', 10), 'action')] }), card, 'action')
    expect(() => resolve(s, { kind: 'engineer', circuitIndex: 0 })).toThrow(IllegalActionError)
  })
})

describe('11 Navigator', () => {
  it('plots a Circuit card for free', () => {
    const card = c('crew', 11)
    let s = play(state({ hand: [card], circuit: [entry(c('data', 4), 'resource')] }), card, 'action')
    expect(s.pending).toEqual([{ kind: 'chooseCards', purpose: 'navigator', max: 1 }])
    s = resolve(s, { kind: 'chooseCards', cardIds: ['data-04'] })
    expect(s.circuit[0].plotted).toBe(true)
    expect(s.pool.data).toBe(0)
  })

  it('plots a card from the discard pile straight into the Course', () => {
    const card = c('crew', 11)
    let s = play(state({ hand: [card], discard: [c('power', 12)] }), card, 'action')
    s = resolve(s, { kind: 'chooseCards', cardIds: ['power-12'] })
    expect(s.course.map((x) => x.id)).toEqual(['power-12'])
    expect(s.discard).toEqual([])
  })

  it('Sync: plots up to 2', () => {
    const card = c('crew', 11)
    const s = play(state({ hand: [card], circuit: [entry(c('crew', 4), 'resource')] }), card, 'action')
    expect(s.pending).toEqual([{ kind: 'chooseCards', purpose: 'navigator', max: 2 }])
  })
})

describe('12 Captain', () => {
  it('draws 2 and flags the next card', () => {
    const card = c('crew', 12)
    const s = play(state({ hand: [card], deck: filler(3) }), card, 'action')
    expect(s.hand).toHaveLength(2)
    expect(s.turnFlags.captainNext).toBe(true)
  })

  it('Sync: draws 3', () => {
    const card = c('crew', 12)
    const s = play(state({ hand: [card], deck: filler(3), circuit: [entry(c('crew', 4), 'resource')] }), card, 'action')
    expect(s.hand).toHaveLength(3)
  })
})
