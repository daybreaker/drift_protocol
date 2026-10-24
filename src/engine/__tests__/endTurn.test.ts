import { describe, expect, it } from 'vitest'
import { apply } from '../engine'
import type { Card, FieldCard, GameState } from '../types'
import { c, entry, filler, pool, state } from './helpers'

const end = (s: GameState) => apply(s, { type: 'endTurn' })
const ids = (cards: (FieldCard | null)[]) => cards.map((x) => x?.id ?? null)
const rail = (): (Card | null)[] => [c('data', 12), c('crew', 6), c('data', 7), c('power', 3), c('shields', 9)]
const board = (o: Partial<GameState> = {}) =>
  state({ calm: false, rail: rail(), yard: filler(10, 'data'), deck: filler(10), ...o })

describe('Impact', () => {
  it('moves every Threat card to the Breach pile', () => {
    const s = end(board({ threat: [c('crew', 9)] }))
    expect(ids(s.breach)).toEqual(['crew-09'])
  })

  it('loses at the Breach limit', () => {
    const s = end(board({ breach: filler(4, 'power'), threat: [c('crew', 9)] }))
    expect(s.outcome).toEqual({ result: 'lost', reason: 'breach' })
  })

  it('the Shield Array raises the limit by 1', () => {
    const base = board({ breach: filler(4, 'power'), threat: [c('crew', 9)] })
    const s = end({ ...base, modules: { ...base.modules, shields: { stationed: [c('crew', 1)], capacity: 1 } } })
    expect(s.outcome).toBeNull()
  })
})

describe('Drift', () => {
  it('vents the Airlock card into the Threat zone when its Cost is 3 or 5', () => {
    const s = end(board())
    expect(ids(s.threat)).toEqual(['data-12'])
  })

  it('Archives a Cost 2 card as debris', () => {
    const r = rail()
    r[0] = c('crew', 4)
    const s = end(board({ rail: r }))
    expect(ids(s.archive)).toEqual(['crew-04'])
    expect(s.threat).toEqual([])
  })

  it('Archives everything during calm start', () => {
    const s = end(board({ calm: true }))
    expect(ids(s.archive)).toEqual(['data-12'])
    expect(s.threat).toEqual([])
  })

  it('vents nothing if the Airlock card was salvaged this turn', () => {
    const r = rail()
    r[0] = null
    const base = board({ rail: r })
    const s = end({ ...base, turnFlags: { ...base.turnFlags, salvagedAirlock: true } })
    expect(s.threat).toEqual([])
    expect(s.archive).toEqual([])
  })

  it('also vents the Inner Lock after Log 2A', () => {
    const s = end(board({ logs: { log1: 'A', log2: 'A' } }))
    expect(ids(s.threat)).toEqual(['data-12', 'crew-06'])
  })

  it('slides cards toward the Airlock in order and refills the Intake from the Yard', () => {
    const r = rail()
    r[2] = null
    const s = end(board({ rail: r, yard: [c('power', 11), c('power', 10)] }))
    expect(ids(s.rail)).toEqual(['crew-06', 'power-03', 'shields-09', 'power-11', 'power-10'])
    expect(s.yard).toEqual([])
  })

  it('loses when the Yard cannot refill the Cargo Rail', () => {
    const s = end(board({ yard: [] }))
    expect(s.outcome).toEqual({ result: 'lost', reason: 'yard' })
  })
})

describe('Cleanup', () => {
  it('discards the Circuit and hand, sends plotted cards to the Course, and draws 5', () => {
    const plotted = c('power', 5)
    const s = end(board({
      hand: [c('crew', 2)],
      circuit: [entry(c('data', 8), 'resource'), entry(plotted, 'action', { plotted: true })],
    }))
    expect(ids(s.course)).toEqual(['power-05'])
    expect(ids(s.discard).sort()).toEqual(['crew-02', 'data-08'])
    expect(s.circuit).toEqual([])
    expect(s.hand).toHaveLength(5)
  })

  it('draws 6 with the Quarters staffed', () => {
    const base = board()
    const s = end({ ...base, modules: { ...base.modules, crew: { stationed: [c('data', 1)], capacity: 1 } } })
    expect(s.hand).toHaveLength(6)
  })

  it('resets the pool and turn flags and advances the turn', () => {
    const base = board({ pool: pool({ data: 4 }) })
    const s = end({ ...base, turn: 3, turnFlags: { ...base.turnFlags, overdrive: 2, patchDiscount: 2 } })
    expect(s.turn).toBe(4)
    expect(s.turnFlags.overdrive).toBe(0)
    expect(s.turnFlags.patchDiscount).toBe(0)
  })
})

describe('Systems Online (next turn)', () => {
  it('each online Module produces its stationed card yield, +1 when the suit matches', () => {
    const r = rail()
    r[0] = c('crew', 2) // debris, so no hazard takes a Module offline
    const base = board({ rail: r })
    const s = end({
      ...base,
      modules: {
        ...base.modules,
        data: { stationed: [c('data', 8)], capacity: 1 },
        power: { stationed: [c('crew', 10)], capacity: 1 },
      },
    })
    expect(s.pool).toEqual(pool({ data: 3, power: 3 }))
    expect(s.turnFlags.production).toEqual(pool({ data: 3, power: 3 }))
  })

  it('an offline Module produces nothing', () => {
    const r = rail()
    r[0] = c('crew', 2)
    const base = board({ rail: r, threat: [] })
    // The Airlock card is debris, so the Threat zone after Drift holds only what we add here.
    const withHazard = { ...base, modules: { ...base.modules, data: { stationed: [c('data', 8)], capacity: 1 } } }
    const s = end(withHazard)
    expect(s.pool.data).toBe(3)
    const r2 = rail()
    r2[0] = c('data', 9)
    const s2 = end({ ...withHazard, rail: r2 })
    expect(ids(s2.threat)).toEqual(['data-09'])
    expect(s2.pool.data).toBe(0)
  })
})
