import { describe, expect, it } from 'vitest'
import { cost, fullDeck, makeCard, yieldOf } from '../cards'
import { shuffle } from '../rng'

describe('cost and yield bands', () => {
  it.each([
    [1, 2, 1], [4, 2, 1],
    [5, 3, 2], [8, 3, 2],
    [9, 5, 3], [12, 5, 3],
  ])('rank %i costs %i and yields %i', (rank, c, y) => {
    expect(cost(rank)).toBe(c)
    expect(yieldOf(rank)).toBe(y)
  })
})

describe('cards', () => {
  it('builds stable ids', () => {
    expect(makeCard('data', 8).id).toBe('data-08')
  })

  it('has 48 unique numbered cards', () => {
    const deck = fullDeck()
    expect(deck).toHaveLength(48)
    expect(new Set(deck.map((c) => c.id)).size).toBe(48)
  })
})

describe('seeded shuffle', () => {
  it('is deterministic for a seed and does not mutate its input', () => {
    const input = fullDeck()
    const [a] = shuffle(input, 42)
    const [b] = shuffle(input, 42)
    expect(a).toEqual(b)
    expect(input).toEqual(fullDeck())
  })

  it('differs between seeds', () => {
    const [a] = shuffle(fullDeck(), 1)
    const [b] = shuffle(fullDeck(), 2)
    expect(a).not.toEqual(b)
  })
})
