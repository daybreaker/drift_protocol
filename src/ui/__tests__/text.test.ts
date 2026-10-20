import { describe, expect, it } from 'vitest'
import { RAIL_SLOTS, railLeftToRight } from '../text'

describe('railLeftToRight', () => {
  it('puts the Intake on the left and the Airlock on the right, keeping engine indices', () => {
    const order = railLeftToRight(['a', 'b', 'c', 'd', 'e'])
    expect(order).toEqual([['e', 4], ['d', 3], ['c', 2], ['b', 1], ['a', 0]])
    expect(order.map(([, i]) => RAIL_SLOTS[i])).toEqual(['Intake', 'Rail', 'Rail', 'Inner Lock', 'Airlock'])
  })
})
