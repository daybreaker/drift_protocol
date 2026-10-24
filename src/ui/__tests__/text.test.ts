import { describe, expect, it } from 'vitest'
import { makeAsteroid, makeCard } from '../../engine'
import { actionName, cardImage, cardName, listCards, RAIL_SLOTS, railLeftToRight } from '../text'

describe('railLeftToRight', () => {
  it('puts the Intake on the left and the Airlock on the right, keeping engine indices', () => {
    const order = railLeftToRight(['a', 'b', 'c', 'd', 'e'])
    expect(order).toEqual([['e', 4], ['d', 3], ['c', 2], ['b', 1], ['a', 0]])
    expect(order.map(([, i]) => RAIL_SLOTS[i])).toEqual(['Intake', 'Rail', 'Rail', 'Inner Lock', 'Airlock'])
  })
})

describe('card names', () => {
  it('names an Asteroid as a hazard with its own image', () => {
    const rock = makeAsteroid(2)
    expect(cardName(rock)).toBe('Asteroid')
    expect(actionName(rock)).toBe('Hazard')
    expect(cardImage(rock)).toMatch(/cards\/Asteroid\.jpg$/)
    expect(listCards([makeCard('crew', 9), rock])).toBe('Crew 9 and Asteroid')
  })
})
