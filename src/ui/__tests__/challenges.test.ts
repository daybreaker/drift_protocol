import { describe, expect, it } from 'vitest'
import { emptyState, makeCard, type ChallengeSlot, type GameState } from '../../engine'
import { challengeStatus, courseQualifies } from '../challenges'

const c = makeCard
const slot = (key: ChallengeSlot['key'], progress = 0, done = false): ChallengeSlot => ({ key, progress, done })
const board = (o: Partial<GameState> = {}): GameState => ({ ...emptyState(), ...o })

describe('challengeStatus', () => {
  it('shows a Tally as a count toward its target', () => {
    expect(challengeStatus(board(), slot('space-junk', 2))).toEqual({ complete: false, detail: '2 of 4' })
    expect(challengeStatus(board(), slot('space-junk', 4, true))).toEqual({ complete: true, detail: '4 of 4' })
  })

  it('shows a Feat as done or still to do within one turn', () => {
    expect(challengeStatus(board(), slot('clean-sweep'))).toEqual({ complete: false, detail: 'Not yet: do it within one turn' })
    expect(challengeStatus(board(), slot('clean-sweep', 0, true))).toEqual({ complete: true, detail: 'Done' })
  })

  it('shows whether a State challenge holds now, since it is checked at the Jump', () => {
    expect(challengeStatus(board(), slot('clean-hull'))).toEqual({ complete: true, detail: 'Met now. Checked when you Jump' })
    expect(challengeStatus(board({ breach: [c('crew', 9), c('crew', 8)] }), slot('clean-hull'))).toEqual({
      complete: false,
      detail: 'Not met now. Checked when you Jump',
    })
  })
})

describe('courseQualifies', () => {
  it('needs every suit and the Jump threshold, ignoring challenges', () => {
    const course14 = [c('power', 4), c('crew', 4), c('data', 3), c('shields', 3)]
    expect(courseQualifies(board(), course14)).toBe(true)
    expect(courseQualifies(board(), course14.slice(1))).toBe(false)
    expect(courseQualifies(board({ jumps: 1 }), course14)).toBe(false)
  })
})
