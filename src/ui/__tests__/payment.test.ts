import { describe, expect, it } from 'vitest'
import { describePayment } from '../payment'

const pool = (p: Partial<Record<'power' | 'crew' | 'data' | 'shields', number>>) => ({ power: 0, crew: 0, data: 0, shields: 0, ...p })

describe('describePayment', () => {
  it('spends the exact suit first, then the wild', () => {
    expect(describePayment(pool({ power: 1, shields: 4 }), 5, 'power', 'shields')).toBe('1 Power + 4 Shields')
    expect(describePayment(pool({ data: 3, power: 5 }), 3, 'data', 'power')).toBe('3 Data')
    expect(describePayment(pool({ power: 5 }), 3, 'data', 'power')).toBe('3 Power')
  })

  it('says when the pool cannot pay, and when nothing is due', () => {
    expect(describePayment(pool({ power: 1, shields: 1 }), 5, 'power', 'shields')).toBeNull()
    expect(describePayment(pool({ crew: 9 }), 2, 'data', 'power')).toBeNull()
    expect(describePayment(pool({}), 0, 'data', 'power')).toBe('nothing')
  })
})
