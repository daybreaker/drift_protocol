import { describe, expect, it } from 'vitest'
import { emptyState, makeCard, type GameState } from '../../engine'
import { locate } from '../locate'

const c = makeCard
const entry = (card: ReturnType<typeof c>, side: 'resource' | 'action') => ({ card, side, synced: false, cascaded: false, plotted: false })
const s: GameState = {
  ...emptyState(),
  hand: [c('data', 1)],
  circuit: [entry(c('crew', 5), 'resource'), entry(c('power', 9), 'action')],
  rail: [c('data', 12), null, null, null, c('shields', 7)],
  modules: { ...emptyState().modules, power: { stationed: [c('crew', 10)], capacity: 1 } },
  discard: [c('crew', 2)],
}

describe('locate', () => {
  it('names the zone, and the slot on the Cargo Rail', () => {
    expect(locate(s, 'data-01').where).toBe('In your hand')
    expect(locate(s, 'data-12').where).toBe('In the Cargo Rail (Airlock)')
    expect(locate(s, 'shields-07').where).toBe('In the Cargo Rail (Intake)')
    expect(locate(s, 'crew-10').where).toBe('Stationed at the Reactor')
    expect(locate(s, 'crew-02').where).toBe('In your discard pile')
  })

  it('reports a Circuit card played action side up as turned', () => {
    expect(locate(s, 'power-09')).toEqual({ where: 'In the Circuit', flipped: true })
    expect(locate(s, 'crew-05')).toEqual({ where: 'In the Circuit', flipped: false })
    expect(locate(s, 'data-01').flipped).toBe(false)
  })
})
