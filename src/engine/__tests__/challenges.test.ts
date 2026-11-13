import { describe, expect, it } from 'vitest'
import { CHALLENGES, type ChallengeKey } from '../challenges'
import { apply, isLegal, newGame } from '../engine'
import { makeAsteroid } from '../cards'
import type { Card, ChallengeSlot, GameState, Suit } from '../types'
import { c, entry, filler, play, pool, resolve, state } from './helpers'

const slot = (key: ChallengeKey, progress = 0): ChallengeSlot => ({ key, progress, done: false })
const end = (s: GameState) => apply(s, { type: 'endTurn' })
const debrisRail = () => [c('crew', 1), c('crew', 6), c('data', 7), c('power', 3), c('shields', 9)]
/** A board where End turn is safe: debris in the Airlock, a full Yard, a deck to draw from. */
const board = (o: Partial<GameState> = {}) => state({ calm: false, rail: debrisRail(), yard: filler(10, 'data'), deck: filler(10), ...o })
/** A board whose only challenge (for Jump 1) is `key`. */
const withChallenge = (key: ChallengeKey, o: Partial<GameState> = {}) => board({ challenges: [[slot(key)], [], []], ...o })
const active = (s: GameState) => s.challenges[s.jumps]
const staff = (s: GameState, cards: Partial<Record<Suit, Card>>): GameState => ({
  ...s,
  modules: Object.fromEntries(
    (Object.keys(s.modules) as Suit[]).map((m) => [m, { ...s.modules[m], stationed: cards[m] ? [cards[m]] : [] }]),
  ) as GameState['modules'],
})

const course14 = [c('power', 4), c('crew', 4), c('data', 3), c('shields', 3)]

describe('the challenge deck', () => {
  it('has 24 challenges: 8 State, 8 Tally and 8 Feat', () => {
    expect(CHALLENGES).toHaveLength(24)
    expect(new Set(CHALLENGES.map((x) => x.key)).size).toBe(24)
    for (const type of ['state', 'tally', 'feat'] as const) expect(CHALLENGES.filter((x) => x.type === type)).toHaveLength(8)
    expect(CHALLENGES.filter((x) => x.type === 'tally').every((x) => (x.target ?? 0) > 0)).toBe(true)
  })
})

describe('setup', () => {
  it('deals one challenge per Jump, in order, from a shuffled deck of 24', () => {
    const s = newGame({ seed: 7 })
    expect(s.challenges.map((leg) => leg.length)).toEqual([1, 1, 1])
    const dealt = s.challenges.flat().map((x) => x.key)
    expect(new Set([...dealt, ...s.challengeDeck]).size).toBe(24)
    expect(s.challengeDeck).toHaveLength(21)
    expect(s.challenges.flat().every((x) => x.progress === 0 && !x.done)).toBe(true)
    expect(newGame({ seed: 7 })).toEqual(s)
  })

  it('deals the same cards as a seed did before challenges existed', () => {
    // Seed 6 has an Asteroid in the Inner Lock; challenges are shuffled after the Yard.
    expect(newGame({ seed: 6 }).rail[1]).toMatchObject({ kind: 'asteroid' })
  })

  it('Veteran deals 2 challenges per Jump and adds nothing to the thresholds', () => {
    const s = newGame({ seed: 7, difficulty: 'veteran' })
    expect(s.challenges.map((leg) => leg.length)).toEqual([2, 2, 2])
    expect(s.challengeDeck).toHaveLength(18)
    expect(s.options).toEqual({ breachLimit: 4 })
  })

  it('Standard has no decision at setup', () => {
    expect(newGame({ seed: 7 }).pending).toEqual([])
  })

  it('Cadet may redeal one challenge from the top of the deck, or keep them all', () => {
    const s = newGame({ seed: 7, difficulty: 'cadet' })
    expect(s.pending).toEqual([{ kind: 'redeal' }])
    const top = s.challengeDeck[0]
    const redealt = resolve(s, { kind: 'redeal', jump: 1 })
    expect(redealt.challenges[1]).toEqual([slot(top)])
    expect(redealt.challenges[0]).toEqual(s.challenges[0])
    expect(redealt.challengeDeck).toHaveLength(20)
    expect(resolve(s, { kind: 'redeal', jump: null }).challenges).toEqual(s.challenges)
    expect(isLegal(s, { type: 'resolve', choice: { kind: 'redeal', jump: 3 } })).toBe(false)
  })
})

describe('the Jump check', () => {
  it('needs the active challenge complete as well as the Course', () => {
    expect(end(withChallenge('clean-hull', { course: course14, breach: [c('crew', 9), c('power', 6)] })).jumps).toBe(0)
    expect(end(withChallenge('clean-hull', { course: course14, breach: [c('crew', 9)] })).jumps).toBe(1)
  })

  it('then makes the next Jump\'s challenge active', () => {
    const s = end(board({ course: course14, challenges: [[slot('clean-hull')], [slot('space-junk')], []] }))
    expect(s.jumps).toBe(1)
    expect(active(s)).toEqual([slot('space-junk')])
  })

  it('needs every active challenge when there are two', () => {
    const challenges = [[slot('clean-hull'), { ...slot('space-junk'), progress: 4, done: true }], [], []]
    expect(end(board({ course: course14, challenges })).jumps).toBe(1)
    const unfinished = [[slot('clean-hull'), slot('space-junk', 3)], [], []]
    expect(end(board({ course: course14, challenges: unfinished })).jumps).toBe(0)
  })
})

describe('State challenges, checked at cleanup', () => {
  const jumps = (key: ChallengeKey, o: Partial<GameState>, prep: (s: GameState) => GameState = (s) => s) =>
    end(prep(withChallenge(key, { course: course14, ...o }))).jumps === 1

  it('Full Crew: all four Modules staffed', () => {
    const three = { power: c('crew', 9), crew: c('data', 9), data: c('power', 9) }
    expect(jumps('full-crew', {}, (s) => staff(s, { ...three, shields: c('crew', 8) }))).toBe(true)
    expect(jumps('full-crew', {}, (s) => staff(s, three))).toBe(false)
  })

  it('Twin Stations: two Modules staffed with their own suit', () => {
    expect(jumps('twin-stations', {}, (s) => staff(s, { power: c('power', 9), crew: c('crew', 9) }))).toBe(true)
    expect(jumps('twin-stations', {}, (s) => staff(s, { power: c('power', 9), crew: c('data', 9) }))).toBe(false)
  })

  it('Clean Hull: Breach holds 1 card or fewer', () => {
    expect(jumps('clean-hull', { breach: [c('crew', 9)] })).toBe(true)
    expect(jumps('clean-hull', { breach: [c('crew', 9), c('crew', 8)] })).toBe(false)
  })

  it('Quiet Sky: no hazard hit at Impact this turn', () => {
    expect(jumps('quiet-sky', {})).toBe(true)
    expect(jumps('quiet-sky', { threat: [c('crew', 9)] })).toBe(false)
  })

  it('Lean Ship: deck, hand and discard hold 15 cards or fewer', () => {
    expect(jumps('lean-ship', { deck: filler(15) })).toBe(true)
    expect(jumps('lean-ship', { deck: filler(16) })).toBe(false)
  })

  it("Deep Course: Course rank at least the Jump's threshold + 5", () => {
    expect(jumps('deep-course', { course: [c('power', 9), c('crew', 4), c('data', 3), c('shields', 3)] })).toBe(true)
    expect(jumps('deep-course', { course: [c('power', 8), c('crew', 4), c('data', 3), c('shields', 3)] })).toBe(false)
  })

  it('Balanced Course: at least 2 cards of every suit', () => {
    const two = (['power', 'crew', 'data', 'shields'] as const).flatMap((suit) => [c(suit, 1), c(suit, 3)])
    expect(jumps('balanced-course', { course: two })).toBe(true)
    expect(jumps('balanced-course', { course: [...two.slice(1), c('crew', 9)] })).toBe(false)
  })

  it('Officer Corps: 3 Course cards of rank 9+', () => {
    expect(jumps('officer-corps', { course: [c('power', 9), c('crew', 10), c('data', 11), c('shields', 1)] })).toBe(true)
    expect(jumps('officer-corps', { course: [c('power', 9), c('crew', 10), c('data', 8), c('shields', 1)] })).toBe(false)
  })
})

describe('Tally challenges', () => {
  const progress = (s: GameState) => active(s)[0].progress

  it('Space Junk counts hazards neutralized and archived, not kept', () => {
    const s = withChallenge('space-junk', { threat: [c('crew', 3), c('data', 3)], pool: pool({ shields: 10 }) })
    expect(progress(apply(s, { type: 'neutralize', threatIndex: 0, keep: 'archive' }))).toBe(1)
    expect(progress(apply(s, { type: 'neutralize', threatIndex: 0, keep: 'discard' }))).toBe(0)
  })

  it('Scrap Run counts Scrap, Jettison and Log 2B', () => {
    let s = withChallenge('scrap-run', { hand: [c('data', 1), c('crew', 4)], discard: [c('power', 1), c('power', 2)] })
    s = apply(s, { type: 'scrap', cardId: 'data-01' })
    expect(progress(s)).toBe(1)
    s = resolve(play(s, c('crew', 4), 'action'), { kind: 'chooseCards', cardIds: ['power-01', 'power-02'] })
    expect(progress(s)).toBe(3)
    const log2 = { ...withChallenge('scrap-run', { discard: [c('power', 5), c('power', 6)] }), jumps: 0, pending: [{ kind: 'log2' as const }] }
    expect(progress(resolve(log2, { kind: 'log2', option: 'B', archive: ['power-05', 'power-06'] }))).toBe(2)
  })

  it('Scrap Run does not count the Course archived on a Jump', () => {
    const s = end(board({ course: course14, challenges: [[slot('clean-hull')], [slot('scrap-run')], []] }))
    expect(s.jumps).toBe(1)
    expect(progress(s)).toBe(0)
  })

  it('Hazard Bounty counts Cost 5 hazards, Asteroids included, archived or kept', () => {
    const s = withChallenge('hazard-bounty', { threat: [c('crew', 9), c('crew', 6), makeAsteroid(1)], pool: pool({ shields: 20 }) })
    expect(progress(apply(s, { type: 'neutralize', threatIndex: 0, keep: 'discard' }))).toBe(1)
    expect(progress(apply(s, { type: 'neutralize', threatIndex: 1, keep: 'archive' }))).toBe(0)
    expect(progress(apply(s, { type: 'neutralize', threatIndex: 2, keep: 'archive' }))).toBe(1)
  })

  it('Airlock Rescue counts salvages from the Airlock, by Tractor Beam too', () => {
    const s = withChallenge('airlock-rescue', { pool: pool({ power: 10 }), hand: [c('crew', 6)] })
    expect(progress(apply(s, { type: 'salvage', railIndex: 0 }))).toBe(1)
    expect(progress(apply(s, { type: 'salvage', railIndex: 2 }))).toBe(0)
    expect(progress(resolve(play(s, c('crew', 6), 'action'), { kind: 'tractorBeam', railIndex: 0 }))).toBe(1)
  })

  it('Recruitment Drive counts stationing, by Dock too', () => {
    const s = withChallenge('recruitment-drive', { hand: [c('data', 1), c('crew', 7)], pool: pool({ crew: 5 }) })
    expect(progress(apply(s, { type: 'station', cardId: 'data-01', module: 'data' }))).toBe(1)
    expect(progress(resolve(play(s, c('crew', 7), 'action'), { kind: 'dock', cardId: 'data-01', module: 'data' }))).toBe(1)
  })

  it('Signal Boost counts plots paid with Data, not Navigator', () => {
    const s = withChallenge('signal-boost', {
      hand: [c('data', 11)],
      discard: [c('power', 1)],
      circuit: [entry(c('crew', 1), 'resource')],
      pool: pool({ data: 5 }),
      modules: { ...state().modules, data: { stationed: [c('data', 1)], capacity: 1 } },
    })
    expect(progress(apply(s, { type: 'plot', circuitIndex: 0 }))).toBe(1)
    expect(progress(apply(s, { type: 'plotFromHand', cardId: 'data-11' }))).toBe(1)
    expect(progress(resolve(play(s, c('data', 11), 'action'), { kind: 'chooseCards', cardIds: ['power-01'] }))).toBe(0)
  })

  it('Hull Repair counts each Breach card moved to the Yard, by Patch or Log 1B', () => {
    const s = withChallenge('hull-repair', { hand: [c('crew', 2)], breach: [c('data', 9), c('power', 9)], circuit: [entry(c('crew', 1), 'resource')] })
    expect(progress(play(s, c('crew', 2), 'action'))).toBe(1)
    const log1 = { ...withChallenge('hull-repair', { breach: [c('data', 9), c('power', 9)] }), pending: [{ kind: 'log1' as const }] }
    expect(progress(resolve(log1, { kind: 'log1', option: 'B' }))).toBe(2)
  })

  it('Heavy Salvage counts Cost 5 cards salvaged', () => {
    const s = withChallenge('heavy-salvage', { pool: pool({ power: 10 }) })
    expect(progress(apply(s, { type: 'salvage', railIndex: 4 }))).toBe(1)
    expect(progress(apply(s, { type: 'salvage', railIndex: 2 }))).toBe(0)
  })

  it('carries across turns, stops at its target and stays complete', () => {
    let s = withChallenge('space-junk', { threat: [c('crew', 3)], pool: pool({ shields: 10 }) })
    s = { ...s, challenges: [[slot('space-junk', 3)], [], []] }
    s = apply(s, { type: 'neutralize', threatIndex: 0, keep: 'archive' })
    expect(active(s)[0]).toEqual({ key: 'space-junk', progress: 4, done: true })
    s = end(s)
    expect(active(s)[0]).toEqual({ key: 'space-junk', progress: 4, done: true })
  })

  it('only counts for the active challenge', () => {
    const s = board({ threat: [c('crew', 3)], pool: pool({ shields: 10 }), challenges: [[slot('clean-hull')], [slot('space-junk')], []] })
    expect(apply(s, { type: 'neutralize', threatIndex: 0, keep: 'archive' }).challenges[1][0].progress).toBe(0)
  })
})

describe('Feat challenges', () => {
  const done = (s: GameState) => active(s)[0].done
  const circuitOf = (cards: Card[], extra: Partial<Parameters<typeof entry>[2]> = {}) => cards.map((x) => entry(x, 'action', extra))

  it('Long Circuit: 6 cards in the Circuit', () => {
    const s = withChallenge('long-circuit', { hand: [c('data', 1)], circuit: circuitOf(filler(5)) })
    expect(done(play(s, c('data', 1), 'resource'))).toBe(true)
    expect(done(withChallenge('long-circuit', { hand: [c('data', 1)], circuit: circuitOf(filler(4)) }))).toBe(false)
  })

  it('Cascade Run: 3 Cascaded cards in the Circuit', () => {
    const s = withChallenge('cascade-run', { hand: [c('data', 4)], circuit: circuitOf([c('crew', 1), c('crew', 2), c('power', 3)]) })
    const twoCascades = { ...s, circuit: s.circuit.map((e, i) => ({ ...e, cascaded: i > 0 })) }
    expect(done(play(twoCascades, c('data', 4), 'resource'))).toBe(true)
  })

  it('Full Sync: 4 cards of one suit in a row, not Captain-Synced ones', () => {
    const s = withChallenge('full-sync', { hand: [c('data', 4)], circuit: circuitOf([c('data', 1), c('data', 2), c('data', 3)]) })
    expect(done(play(s, c('data', 4), 'resource'))).toBe(true)
    const mixed = withChallenge('full-sync', { hand: [c('data', 4)], circuit: circuitOf([c('crew', 1), c('power', 2), c('data', 3)], { synced: true }) })
    expect(done(play(mixed, c('data', 4), 'resource'))).toBe(false)
  })

  it('Overclock: 10 resources in the pool at once, from production too', () => {
    const s = withChallenge('overclock', { hand: [c('data', 1)], pool: pool({ power: 5, crew: 4 }) })
    expect(done(play(s, c('data', 1), 'resource'))).toBe(true)
    const staffed = staff(withChallenge('overclock'), { power: c('power', 12), crew: c('crew', 12), data: c('data', 9) })
    expect(done(end(staffed))).toBe(true)
  })

  it('Spectrum: a card of each suit played resource side up', () => {
    const three = [c('power', 1), c('crew', 1), c('data', 1)].map((x) => entry(x, 'resource'))
    const s = withChallenge('spectrum', { hand: [c('shields', 5)], circuit: three })
    expect(done(play(s, c('shields', 5), 'resource'))).toBe(true)
    expect(done(play(s, c('shields', 5), 'action'))).toBe(false)
  })

  it('Bridge Crew: a 10, an 11 and a 12 in the Circuit, either side', () => {
    const s = withChallenge('bridge-crew', { hand: [c('data', 12)], circuit: [entry(c('crew', 10), 'resource'), entry(c('power', 11), 'resource')] })
    expect(done(play(s, c('data', 12), 'resource'))).toBe(true)
  })

  it('Clean Sweep: neutralize 2 hazards in one turn', () => {
    let s = withChallenge('clean-sweep', { threat: [c('crew', 3), c('data', 3)], pool: pool({ shields: 4 }) })
    s = apply(s, { type: 'neutralize', threatIndex: 0, keep: 'archive' })
    expect(done(s)).toBe(false)
    expect(done(apply(s, { type: 'neutralize', threatIndex: 0, keep: 'archive' }))).toBe(true)
  })

  it('Salvage Spree: salvage 3 cards in one turn, by Tractor Beam too', () => {
    let s = withChallenge('salvage-spree', { hand: [c('crew', 6)], pool: pool({ power: 20 }) })
    s = apply(apply(s, { type: 'salvage', railIndex: 0 }), { type: 'salvage', railIndex: 1 })
    expect(done(s)).toBe(false)
    expect(done(resolve(play(s, c('crew', 6), 'action'), { kind: 'tractorBeam', railIndex: 2 }))).toBe(true)
  })

  it('counts this turn only, and once done stays done', () => {
    let s = withChallenge('clean-sweep', { threat: [c('crew', 3)], pool: pool({ shields: 2 }) })
    s = end(apply(s, { type: 'neutralize', threatIndex: 0, keep: 'archive' }))
    expect(s.turnFlags.neutralizes).toBe(0)
    expect(done(s)).toBe(false)
    const finished = end(board({ challenges: [[{ ...slot('clean-sweep'), done: true }], [], []] }))
    expect(done(finished)).toBe(true)
  })
})
