import { describe, expect, it } from 'vitest'
import { makeAsteroid } from '../cards'
import { apply, IllegalActionError, legalActions, newGame } from '../engine'
import { isOnline, neutralizeCost } from '../rules'
import type { FieldCard, GameState } from '../types'
import { c, entry, filler, play, pool, resolve, state } from './helpers'

const rock = makeAsteroid(1)
const end = (s: GameState) => apply(s, { type: 'endTurn' })
const ids = (cards: (FieldCard | null)[]) => cards.map((x) => x?.id ?? null)
const board = (o: Partial<GameState> = {}) =>
  state({ calm: false, rail: [c('data', 12), c('crew', 6), c('data', 7), c('power', 3), c('shields', 9)], yard: filler(10, 'data'), deck: filler(10), ...o })

describe('Asteroids', () => {
  it('start as two cards shuffled into the Yard, never in the deck or hand', () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame({ seed })
      expect(ids([...s.yard, ...s.rail]).filter((id) => id?.startsWith('asteroid'))).toHaveLength(2)
      expect([...s.deck, ...s.hand].some((x) => x.id.startsWith('asteroid'))).toBe(false)
    }
  })

  it('cannot be salvaged', () => {
    const s = board({ rail: [rock, null, null, null, null], pool: pool({ power: 9 }) })
    expect(legalActions(s).some((a) => a.type === 'salvage')).toBe(false)
    expect(() => apply(s, { type: 'salvage', railIndex: 0 })).toThrow(IllegalActionError)
  })

  it('cannot be taken by Tractor Beam', () => {
    const beam = c('power', 6)
    const s = play(board({ hand: [beam], rail: [rock, null, null, null, null] }), beam, 'action')
    expect(legalActions(s)).toEqual([{ type: 'resolve', choice: { kind: 'tractorBeam', railIndex: null } }])
    expect(() => resolve(s, { kind: 'tractorBeam', railIndex: 0 })).toThrow(IllegalActionError)
  })

  it('cannot be taken by Log 2A', () => {
    const s = board({ rail: [rock, c('crew', 6), c('data', 7), null, null], pending: [{ kind: 'log2' }] })
    const picks = legalActions(s).flatMap((a) => (a.type === 'resolve' && a.choice.kind === 'log2' && a.choice.option === 'A' ? [a.choice.railIndices] : []))
    expect(picks).toEqual([[1, 2]])
    expect(() => resolve(s, { kind: 'log2', option: 'A', railIndices: [0, 1] })).toThrow(IllegalActionError)
  })

  it('always drift into the Threat zone, even during calm start', () => {
    const rail = [rock, c('crew', 6), c('data', 7), c('power', 3), c('shields', 9)]
    expect(ids(end(board({ rail })).threat)).toEqual(['asteroid-1'])
    expect(ids(end(board({ rail, calm: true })).threat)).toEqual(['asteroid-1'])
  })

  it('take no Module offline', () => {
    const s = board({ threat: [rock] })
    expect(['power', 'crew', 'data', 'shields'].every((m) => isOnline(s, m as never))).toBe(true)
  })

  it('cost 5 to neutralize, in Shields only, and are archived', () => {
    const s = apply(board({ threat: [rock], pool: pool({ shields: 6 }) }), { type: 'neutralize', threatIndex: 0, keep: 'archive' })
    expect(s.pool.shields).toBe(1)
    expect(ids(s.archive)).toEqual(['asteroid-1'])
    expect(s.threat).toEqual([])
    const rich = board({ threat: [rock], pool: pool({ power: 9, crew: 9, data: 9, shields: 4 }) })
    expect(() => apply(rich, { type: 'neutralize', threatIndex: 0, keep: 'archive' })).toThrow(IllegalActionError)
  })

  it('can never be kept', () => {
    const s = board({ threat: [rock], pool: pool({ shields: 20 }) })
    expect(legalActions(s).filter((a) => a.type === 'neutralize')).toEqual([{ type: 'neutralize', threatIndex: 0, keep: 'archive' }])
    expect(neutralizeCost(s, 0, 'discard')).toBeNull()
    expect(() => apply(s, { type: 'neutralize', threatIndex: 0, keep: 'discard' })).toThrow(IllegalActionError)
  })

  it("take Patch's discount and Log 2B's +1 like any hazard", () => {
    const patch = c('data', 2)
    const patched = play(board({ hand: [patch], threat: [rock], pool: pool({ shields: 3 }) }), patch, 'action')
    expect(neutralizeCost(patched, 0, 'archive')).toBe(3)
    expect(neutralizeCost(board({ threat: [rock], logs: { log2: 'B' } }), 0, 'archive')).toBe(6)
  })

  it('hit like any hazard and can return to the Yard from Breach', () => {
    const hit = end(board({ threat: [rock] }))
    expect(ids(hit.breach)).toEqual(['asteroid-1'])
    const patch = c('data', 2)
    const s = play(board({ hand: [patch], breach: [rock], circuit: [entry(c('data', 5), 'resource')] }), patch, 'action')
    expect(s.yard.at(-1)?.id).toBe('asteroid-1')
  })
})
