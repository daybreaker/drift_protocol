import { describe, expect, it } from 'vitest'
import { apply } from '../engine'
import type { GameState } from '../types'
import { c, filler, resolve, state } from './helpers'

const end = (s: GameState) => apply(s, { type: 'endTurn' })
const debrisRail = () => [c('crew', 1), c('crew', 6), c('data', 7), c('power', 3), c('shields', 9)]
const board = (o: Partial<GameState> = {}) =>
  state({ calm: false, rail: debrisRail(), yard: filler(10, 'data'), deck: filler(10), ...o })

const course11 = [c('power', 3), c('crew', 3), c('data', 3), c('shields', 2)]

describe('Jump check at cleanup', () => {
  it('Jumps when the Course holds every suit and enough rank', () => {
    const s = end(board({ course: course11, threat: [], breach: [] }))
    expect(s.jumps).toBe(1)
    expect(s.course).toEqual([])
    expect(s.archive.map((x) => x.id)).toEqual(expect.arrayContaining(course11.map((x) => x.id)))
    expect(s.pending).toEqual([{ kind: 'log1' }])
  })

  it('Archives the Threat zone on a Jump', () => {
    const r = debrisRail()
    r[0] = c('data', 12)
    const s = end(board({ rail: r, course: course11 }))
    expect(s.threat).toEqual([])
  })

  it('does not Jump with a suit missing', () => {
    const s = end(board({ course: [c('power', 12), c('crew', 12), c('data', 12)] }))
    expect(s.jumps).toBe(0)
  })

  it('does not Jump below the threshold', () => {
    const s = end(board({ course: [c('power', 3), c('crew', 3), c('data', 2), c('shields', 2)] }))
    expect(s.jumps).toBe(0)
  })

  it('Veteran adds 5 to each threshold', () => {
    const s = end(board({ course: course11, options: { breachLimit: 4, jumpBonus: 5 } }))
    expect(s.jumps).toBe(0)
  })
})

describe('Log 1', () => {
  const afterJump = () => end(board({ course: course11, breach: [c('crew', 9), c('power', 6)] }))

  it('A: a chosen Module can hold two stationed cards', () => {
    const s = resolve(afterJump(), { kind: 'log1', option: 'A', module: 'data' })
    expect(s.modules.data.capacity).toBe(2)
    expect(s.logs.log1).toBe('A')
    expect(s.pending).toEqual([])
  })

  it('B: every Breach card goes to the bottom of the Yard', () => {
    const before = afterJump()
    const s = resolve(before, { kind: 'log1', option: 'B' })
    expect(s.breach).toEqual([])
    expect(s.yard.slice(-2).map((x) => x.id).sort()).toEqual(['crew-09', 'power-06'])
  })
})

describe('Log 2', () => {
  const course20 = [c('power', 5), c('crew', 5), c('data', 5), c('shields', 5)]
  const afterJump = (o: Partial<GameState> = {}) => end(board({ jumps: 1, logs: { log1: 'A' }, course: course20, ...o }))

  it('is offered on the second Jump', () => {
    expect(afterJump().pending).toEqual([{ kind: 'log2' }])
  })

  it('A: takes two chosen Cargo Rail cards into hand', () => {
    const before = afterJump()
    const picks = [before.rail[0]!, before.rail[1]!]
    const s = resolve(before, { kind: 'log2', option: 'A', railIndices: [0, 1] })
    expect(s.hand).toEqual(expect.arrayContaining(picks))
    expect(s.rail[0]).toBeNull()
    expect(s.logs.log2).toBe('A')
  })

  it('B: Archives up to 3 chosen cards from hand or discard', () => {
    const before = afterJump()
    const victims = before.hand.slice(0, 3).map((x) => x.id)
    const s = resolve(before, { kind: 'log2', option: 'B', archive: victims })
    expect(s.archive.map((x) => x.id)).toEqual(expect.arrayContaining(victims))
    expect(s.logs.log2).toBe('B')
  })
})

describe('Jump 3', () => {
  it('wins and scores Yard + 3 per staffed Module − 2 per Breach card', () => {
    const course30 = [c('power', 8), c('crew', 8), c('data', 7), c('shields', 7)]
    const base = board({ jumps: 2, logs: { log1: 'A', log2: 'B' }, course: course30, breach: [c('crew', 9)] })
    const s = end({ ...base, modules: { ...base.modules, crew: { stationed: [c('data', 1)], capacity: 1 } } })
    // Yard: 10 − 1 refill = 9. One staffed Module. One Breach card.
    expect(s.outcome).toEqual({ result: 'won', score: 9 + 3 - 2 })
  })
})
