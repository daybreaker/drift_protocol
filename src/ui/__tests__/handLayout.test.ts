import { describe, expect, it } from 'vitest'
import { makeCard } from '../../engine'
import { moveId, orderHand, reconcileSlots, type Slot } from '../handLayout'

const [a, b, c, d] = [makeCard('data', 1), makeCard('crew', 2), makeCard('power', 3), makeCard('shields', 4)]
const ids = (slots: Slot[]) => slots.map((s) => (s.leaving ? `(${s.card.id})` : s.card.id))

describe('orderHand', () => {
  it('follows the saved order and puts new cards at the end in draw order', () => {
    expect(orderHand([a, b, c, d], ['power-03', 'data-01']).map((x) => x.id)).toEqual(['power-03', 'data-01', 'crew-02', 'shields-04'])
  })
})

describe('reconcileSlots', () => {
  const start: Slot[] = [{ card: a }, { card: b }, { card: c }]

  it('leaves a gap where a card left the hand', () => {
    expect(ids(reconcileSlots(start, [a, c]))).toEqual(['data-01', '(crew-02)', 'power-03'])
  })

  it('appends drawn cards after the existing ones', () => {
    expect(ids(reconcileSlots(start, [a, b, c, d]))).toEqual(['data-01', 'crew-02', 'power-03', 'shields-04'])
  })

  it('gives a returning card its old place back', () => {
    const gapped = reconcileSlots(start, [a, c])
    expect(ids(reconcileSlots(gapped, [a, b, c]))).toEqual(['data-01', 'crew-02', 'power-03'])
  })

  it('refills the occupied places in the new order after a reorder', () => {
    const gapped = reconcileSlots(start, [a, c])
    expect(ids(reconcileSlots(gapped, [c, a]))).toEqual(['power-03', '(crew-02)', 'data-01'])
  })
})

describe('moveId', () => {
  it('moves an id to a new index', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c'])
  })
})
