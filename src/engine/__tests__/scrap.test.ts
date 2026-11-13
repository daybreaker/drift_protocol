import { describe, expect, it } from 'vitest'
import { apply, IllegalActionError, isLegal, legalActions } from '../engine'
import { c, entry, play, pool, state } from './helpers'

describe('Scrap', () => {
  it('Archives a card from hand and gains 2 of its resource', () => {
    const card = c('data', 9)
    const s = apply(state({ hand: [card] }), { type: 'scrap', cardId: card.id })
    expect(s.hand).toEqual([])
    expect(s.archive).toEqual([card])
    expect(s.pool).toEqual(pool({ data: 2 }))
  })

  it('is not a play: the Circuit is unchanged and the previous card still chains', () => {
    const scrapped = c('data', 6)
    const next = c('crew', 7)
    let s = state({ hand: [scrapped, next], circuit: [entry(c('crew', 6), 'resource')] })
    s = apply(s, { type: 'scrap', cardId: scrapped.id })
    expect(s.circuit).toHaveLength(1)
    s = play(s, next, 'resource')
    expect(s.circuit[1]).toMatchObject({ synced: true, cascaded: true })
  })

  it("does not use up Captain's next-card bonus", () => {
    const base = state({ hand: [c('data', 1)] })
    const s = apply({ ...base, turnFlags: { ...base.turnFlags, captainNext: true } }, { type: 'scrap', cardId: 'data-01' })
    expect(s.turnFlags.captainNext).toBe(true)
  })

  it('is not boosted by Overdrive', () => {
    const base = state({ hand: [c('data', 1)] })
    const s = apply({ ...base, turnFlags: { ...base.turnFlags, overdrive: 2 } }, { type: 'scrap', cardId: 'data-01' })
    expect(s.pool.data).toBe(2)
  })

  it('ends the recall window', () => {
    const stationed = c('crew', 9)
    const base = state({ hand: [c('data', 1)] })
    const s = apply({ ...base, modules: { ...base.modules, crew: { stationed: [stationed], capacity: 1 } } }, { type: 'scrap', cardId: 'data-01' })
    expect(isLegal(s, { type: 'recall', module: 'crew', cardId: stationed.id })).toBe(false)
  })

  it('is offered for each hand card, and only with no decision pending', () => {
    const card = c('data', 1)
    expect(legalActions(state({ hand: [card] }))).toContainEqual({ type: 'scrap', cardId: card.id })
    const pending = state({ hand: [card], pending: [{ kind: 'chooseResource', amount: 1 }] })
    expect(() => apply(pending, { type: 'scrap', cardId: card.id })).toThrow(IllegalActionError)
    expect(() => apply(state({ hand: [card] }), { type: 'scrap', cardId: 'crew-05' })).toThrow(IllegalActionError)
  })
})
