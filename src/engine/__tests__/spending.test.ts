import { describe, expect, it } from 'vitest'
import { apply, IllegalActionError } from '../engine'
import type { GameState } from '../types'
import { c, entry, pool, state } from './helpers'

const rail = [c('data', 12), c('crew', 6), c('data', 7), c('power', 3), c('shields', 9)]
const withModules = (s: GameState, m: Partial<GameState['modules']>): GameState => ({ ...s, modules: { ...s.modules, ...m } })

describe('Salvage', () => {
  it('pays the card suit first, then Power, and puts the card in the discard', () => {
    const s = apply(state({ rail, pool: pool({ data: 1, power: 5 }) }), { type: 'salvage', railIndex: 2 })
    expect(s.pool).toEqual(pool({ power: 3 }))
    expect(s.discard.map((x) => x.id)).toEqual(['data-07'])
    expect(s.rail[2]).toBeNull()
  })

  it('discounts the Airlock by 2 and the Inner Lock by 1', () => {
    const airlock = apply(state({ rail, pool: pool({ data: 3 }) }), { type: 'salvage', railIndex: 0 })
    expect(airlock.pool.data).toBe(0)
    expect(airlock.turnFlags.salvagedAirlock).toBe(true)
    const inner = apply(state({ rail, pool: pool({ crew: 2 }) }), { type: 'salvage', railIndex: 1 })
    expect(inner.pool.crew).toBe(0)
  })

  it('cannot be paid with an off-suit resource other than Power', () => {
    expect(() => apply(state({ rail, pool: pool({ crew: 9 }) }), { type: 'salvage', railIndex: 2 })).toThrow(IllegalActionError)
  })
})

describe('Neutralize', () => {
  const threat = [c('crew', 9)]

  it('pays the hazard suit first, then Shields, and keeps or Archives the card', () => {
    const kept = apply(state({ threat, pool: pool({ crew: 2, shields: 4 }) }), { type: 'neutralize', threatIndex: 0, keep: 'discard' })
    expect(kept.pool).toEqual(pool({ shields: 1 }))
    expect(kept.discard.map((x) => x.id)).toEqual(['crew-09'])
    expect(kept.threat).toEqual([])
    const archived = apply(state({ threat, pool: pool({ shields: 5 }) }), { type: 'neutralize', threatIndex: 0, keep: 'archive' })
    expect(archived.archive.map((x) => x.id)).toEqual(['crew-09'])
  })

  it('costs 1 more after Log 2B', () => {
    const s = state({ threat, pool: pool({ shields: 5 }), logs: { log2: 'B' } })
    expect(() => apply(s, { type: 'neutralize', threatIndex: 0, keep: 'archive' })).toThrow(IllegalActionError)
  })

  it('cannot be paid with Power', () => {
    const s = state({ threat, pool: pool({ power: 9 }) })
    expect(() => apply(s, { type: 'neutralize', threatIndex: 0, keep: 'archive' })).toThrow(IllegalActionError)
  })
})

describe('Station', () => {
  const worker = c('data', 9)

  it('costs the card Cost in Crew and moves it under the Module', () => {
    const s = apply(state({ hand: [worker], pool: pool({ crew: 5 }) }), { type: 'station', cardId: worker.id, module: 'data' })
    expect(s.pool.crew).toBe(0)
    expect(s.modules.data.stationed).toEqual([worker])
    expect(s.hand).toEqual([])
    expect(s.circuit).toEqual([])
  })

  it('cannot use Power as a wild', () => {
    const s = state({ hand: [worker], pool: pool({ power: 9 }) })
    expect(() => apply(s, { type: 'station', cardId: worker.id, module: 'data' })).toThrow(IllegalActionError)
  })

  it('is illegal at an offline Module or a full one', () => {
    const offline = state({ hand: [worker], pool: pool({ crew: 5 }), threat: [c('data', 6)] })
    expect(() => apply(offline, { type: 'station', cardId: worker.id, module: 'data' })).toThrow(IllegalActionError)
    const full = withModules(state({ hand: [worker], pool: pool({ crew: 5 }) }), { data: { stationed: [c('crew', 1)], capacity: 1 } })
    expect(() => apply(full, { type: 'station', cardId: worker.id, module: 'data' })).toThrow(IllegalActionError)
  })
})

describe('Plot', () => {
  it('costs 2 Data and marks a Circuit card for the Course', () => {
    const s = apply(state({ circuit: [entry(c('power', 5), 'resource')], pool: pool({ data: 2 }) }), { type: 'plot', circuitIndex: 0 })
    expect(s.circuit[0].plotted).toBe(true)
    expect(s.pool.data).toBe(0)
  })

  it('cannot plot the same card twice', () => {
    const s = state({ circuit: [entry(c('power', 5), 'resource', { plotted: true })], pool: pool({ data: 2 }) })
    expect(() => apply(s, { type: 'plot', circuitIndex: 0 })).toThrow(IllegalActionError)
  })

  it('can plot from hand only with the Nav Core staffed', () => {
    const card = c('power', 5)
    const s = state({ hand: [card], pool: pool({ data: 2 }) })
    expect(() => apply(s, { type: 'plotFromHand', cardId: card.id })).toThrow(IllegalActionError)
    const staffed = withModules(s, { data: { stationed: [c('crew', 1)], capacity: 1 } })
    expect(apply(staffed, { type: 'plotFromHand', cardId: card.id }).course).toEqual([card])
  })
})

describe('Recall', () => {
  it('returns a stationed card to hand and refunds its production, before anything is played', () => {
    const worker = c('data', 9)
    const base = withModules(state({ pool: pool({ data: 4 }) }), { data: { stationed: [worker], capacity: 1 } })
    const s0 = { ...base, turnFlags: { ...base.turnFlags, production: pool({ data: 4 }) } }
    const s = apply(s0, { type: 'recall', module: 'data', cardId: worker.id })
    expect(s.hand).toEqual([worker])
    expect(s.modules.data.stationed).toEqual([])
    expect(s.pool.data).toBe(0)
  })

  it('is illegal once a card has been played or anything spent', () => {
    const worker = c('data', 9)
    const base = withModules(state(), { data: { stationed: [worker], capacity: 1 } })
    const s = { ...base, turnFlags: { ...base.turnFlags, playedOrSpent: true } }
    expect(() => apply(s, { type: 'recall', module: 'data', cardId: worker.id })).toThrow(IllegalActionError)
  })
})
