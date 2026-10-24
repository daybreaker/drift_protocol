import { describe, expect, it } from 'vitest'
import { apply, emptyState, makeAsteroid, makeCard, type GameState } from '../../engine'
import { summarizeEndTurn } from '../summary'

const c = makeCard
const filler = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f-${i}`, suit: 'crew' as const, rank: 1 }))
const board = (o: Partial<GameState> = {}): GameState => ({
  ...emptyState(),
  calm: false,
  rail: [c('data', 12), c('crew', 6), c('data', 7), c('power', 3), c('shields', 9)],
  yard: filler(10),
  deck: filler(10),
  ...o,
})
const end = (s: GameState) => summarizeEndTurn(s, apply(s, { type: 'endTurn' }))

describe('summarizeEndTurn', () => {
  it('reports hazards that hit and the Breach count', () => {
    expect(end(board({ threat: [c('crew', 9)], breach: [c('power', 6)] }))).toContain('Crew 9 hit the hull. Breach 2 of 5.')
  })

  it('reports what drifted out of the Airlock and where it went', () => {
    expect(end(board())).toContain('Data 12 drifted out of the Airlock and is now a hazard.')
    const debris = board({ rail: [c('crew', 4), null, null, null, null] })
    expect(end(debris)).toContain('Crew 4 drifted out of the Airlock as debris.')
    const rock = board({ calm: true, rail: [makeAsteroid(1), null, null, null, null] })
    expect(end(rock)).toContain('Asteroid drifted out of the Airlock and is now a hazard.')
  })

  it('reports the first reshuffle and Module production', () => {
    const s = board({
      calm: true,
      deck: [],
      discard: filler(6),
      rail: [c('crew', 4), c('crew', 6), c('data', 7), c('power', 3), c('shields', 9)],
      modules: { ...emptyState().modules, data: { stationed: [c('data', 8)], capacity: 1 } },
    })
    const lines = end(s)
    expect(lines).toContain('Your deck ran out and the discard pile was reshuffled. Calm start is over.')
    expect(lines).toContain('Modules produced 3 Data.')
  })

  it('reports a Jump', () => {
    const course = [c('power', 4), c('crew', 4), c('data', 3), c('shields', 3)]
    expect(end(board({ course }))).toContain('Jump 1 complete.')
  })
})
