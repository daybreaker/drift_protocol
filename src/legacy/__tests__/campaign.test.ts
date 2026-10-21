import { describe, expect, it } from 'vitest'
import { apply, emptyState, IllegalActionError, legalActions, makeCard, newGame, type GameState } from '../../engine'
import { createLegacyGame, mergeChanges, recordAction, startSession, undoAction } from '../campaign'
import type { Campaign, Ctx, SessionRecord } from '../records'

function testCtx(): Ctx {
  let id = 0
  let tick = 0
  return {
    now: () => new Date(Date.UTC(2026, 9, 21, 12, 0, tick++)).toISOString(),
    newId: () => `id-${++id}`,
    newSeed: () => 42,
  }
}

const input = { name: 'Halcyon', difficulty: 'standard' as const, starting_threes: ['crew', 'data'] as ['crew', 'data'] }

function freshCampaign(ctx = testCtx()): Campaign {
  return mergeChanges(null, createLegacyGame(input, ctx))
}

function withSession(ctx = testCtx()): { campaign: Campaign; session: SessionRecord; ctx: Ctx } {
  const base = freshCampaign(ctx)
  const campaign = mergeChanges(base, startSession(base, ctx))
  return { campaign, session: campaign.sessions[0], ctx }
}

const c = makeCard
const filler = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f-${i}`, suit: 'crew' as const, rank: 1 }))
const endgame = (o: Partial<GameState>): GameState => ({
  ...emptyState(),
  calm: false,
  rail: [c('crew', 4), c('crew', 6), c('data', 7), c('power', 3), c('shields', 9)],
  yard: filler(10),
  deck: filler(10),
  ...o,
})
/** One End turn from winning: the third Jump is plotted. */
const aboutToWin = endgame({ jumps: 2, course: [c('power', 12), c('crew', 12), c('data', 3), c('shields', 3)] })
/** One End turn from losing: a hazard hits a hull at 4 of 5 Breach. */
const aboutToLose = endgame({ threat: [c('crew', 9)], breach: filler(4).map((x, i) => ({ ...x, id: `b-${i}` })) })

describe('createLegacyGame', () => {
  it('starts at the first Story with no Credits and one active chapter', () => {
    const changes = createLegacyGame(input, testCtx())
    const [game] = changes.legacy_games!
    const [chapter] = changes.chapters!
    expect(game).toMatchObject({ name: 'Halcyon', difficulty: 'standard', starting_threes: ['crew', 'data'], credits: 0 })
    expect(chapter).toMatchObject({ legacy_game_id: game.id, story_key: 'salvage-rights', position: 1, status: 'active', completed_at: null })
    expect(game.current_chapter_id).toBe(chapter.id)
  })

  it('stores no starting 3s for Cadet', () => {
    const [game] = createLegacyGame({ ...input, difficulty: 'cadet' }, testCtx()).legacy_games!
    expect(game.starting_threes).toBeNull()
  })
})

describe('startSession', () => {
  it("starts attempt 1 of the current chapter with the campaign's difficulty and starting 3s", () => {
    const { campaign, session } = withSession()
    expect(session).toMatchObject({
      legacy_game_id: campaign.legacyGame.id,
      chapter_id: campaign.legacyGame.current_chapter_id,
      attempt: 1,
      status: 'in_progress',
      action_count: 0,
      options: { seed: 42, difficulty: 'standard', startingThrees: ['crew', 'data'] },
    })
    expect(session.state).toEqual(newGame(session.options))
  })

  it('refuses a second Session while one is in progress', () => {
    const { campaign, ctx } = withSession()
    expect(() => startSession(campaign, ctx)).toThrow()
  })
})

describe('recordAction', () => {
  it('applies the action and logs it against the session, chapter and legacy game', () => {
    const { campaign, session, ctx } = withSession()
    const action = legalActions(session.state).find((a) => a.type === 'playCard')!
    const changes = recordAction(campaign, session, action, ctx)
    const [next] = changes.sessions!
    const [logged] = changes.actions!
    expect(next.state).toEqual(apply(session.state, action))
    expect(next.action_count).toBe(1)
    expect(logged).toMatchObject({
      session_id: session.id,
      chapter_id: session.chapter_id,
      legacy_game_id: session.legacy_game_id,
      seq: 1,
      turn: 1,
      action,
      undone_at: null,
    })
    expect(next.undo_states).toEqual([session.state])
    expect(next.undo_action_ids).toEqual([logged.id])
  })

  it('clears undo and writes the summary at the end of a turn', () => {
    const { campaign, session, ctx } = withSession()
    const played = mergeChanges(campaign, recordAction(campaign, session, legalActions(session.state).find((a) => a.type === 'playCard')!, ctx))
    const ended = recordAction(played, played.sessions[0], { type: 'endTurn' }, ctx).sessions![0]
    expect(ended.undo_states).toEqual([])
    expect(ended.undo_action_ids).toEqual([])
    expect(ended.state.turn).toBe(2)
  })

  it('rejects an illegal action', () => {
    const { campaign, session, ctx } = withSession()
    expect(() => recordAction(campaign, session, { type: 'salvage', railIndex: 9 }, ctx)).toThrow(IllegalActionError)
  })

  it('turns a won Session into Credits and opens the next chapter if there is one', () => {
    const { campaign, session, ctx } = withSession()
    const changes = recordAction(campaign, { ...session, state: aboutToWin }, { type: 'endTurn' }, ctx)
    const [ended] = changes.sessions!
    const [game] = changes.legacy_games!
    const [chapter] = changes.chapters!
    expect(ended.state.outcome).toMatchObject({ result: 'won' })
    expect(ended).toMatchObject({ status: 'won', score: ended.state.outcome?.result === 'won' && ended.state.outcome.score })
    expect(ended.credits_earned).toBe(ended.score)
    expect(ended.ended_at).not.toBeNull()
    expect(game.credits).toBe(ended.score)
    expect(chapter).toMatchObject({ id: session.chapter_id, status: 'completed' })
    expect(chapter.completed_at).not.toBeNull()
    // Salvage Rights is the only Story so far, so no new chapter opens.
    expect(changes.chapters).toHaveLength(1)
    expect(game.current_chapter_id).toBe(session.chapter_id)
  })

  it('earns nothing for a lost Session and keeps the chapter for another attempt', () => {
    const { campaign, session, ctx } = withSession()
    const changes = recordAction(campaign, { ...session, state: aboutToLose }, { type: 'endTurn' }, ctx)
    const [ended] = changes.sessions!
    expect(ended).toMatchObject({ status: 'lost', score: null, credits_earned: 0 })
    expect(changes.legacy_games).toBeUndefined()
    expect(changes.chapters).toBeUndefined()
    const after = mergeChanges(campaign, changes)
    const retry = startSession(after, ctx).sessions![0]
    expect(retry).toMatchObject({ attempt: 2, chapter_id: session.chapter_id })
  })

  it('refuses actions once the Session has ended, and refuses a Session for a completed chapter', () => {
    const { campaign, session, ctx } = withSession()
    const won = mergeChanges(campaign, recordAction(campaign, { ...session, state: aboutToWin }, { type: 'endTurn' }, ctx))
    expect(() => recordAction(won, won.sessions[0], { type: 'endTurn' }, ctx)).toThrow()
    expect(() => startSession(won, ctx)).toThrow()
  })

  it('never mutates the records it is given', () => {
    const { campaign, session, ctx } = withSession()
    const before = structuredClone(campaign)
    recordAction(campaign, session, legalActions(session.state)[0], ctx)
    expect(campaign).toEqual(before)
  })
})

describe('undoAction', () => {
  it('restores the previous state and marks the logged action undone', () => {
    const { campaign, session, ctx } = withSession()
    const action = legalActions(session.state).find((a) => a.type === 'playCard')!
    const changes = recordAction(campaign, session, action, ctx)
    const played = changes.sessions![0]
    const undone = undoAction(played, changes.actions![0], ctx)
    expect(undone.sessions![0].state).toEqual(session.state)
    expect(undone.sessions![0].undo_states).toEqual([])
    expect(undone.sessions![0].action_count).toBe(1)
    expect(undone.actions![0]).toMatchObject({ id: changes.actions![0].id, seq: 1 })
    expect(undone.actions![0].undone_at).not.toBeNull()
  })

  it('only undoes the most recent action of this turn', () => {
    const { session, ctx } = withSession()
    expect(() => undoAction(session, { id: 'nope' } as never, ctx)).toThrow()
  })
})

describe('the action log', () => {
  it('replays to the current state, skipping undone actions', () => {
    const start = withSession()
    const { ctx } = start
    let { campaign, session } = start
    const log: { id: string; action: Parameters<typeof apply>[1]; undone: boolean }[] = []
    for (let step = 0; step < 40 && session.status === 'in_progress'; step++) {
      const options = legalActions(session.state)
      const action = options.find((a) => a.type !== 'endTurn') ?? options[0]
      const changes = recordAction(campaign, session, action, ctx)
      campaign = mergeChanges(campaign, changes)
      session = campaign.sessions[0]
      log.push({ id: changes.actions![0].id, action, undone: false })
      if (step % 7 === 3 && session.undo_action_ids.length > 0) {
        campaign = mergeChanges(campaign, undoAction(session, changes.actions![0], ctx))
        session = campaign.sessions[0]
        log[log.length - 1].undone = true
      }
    }
    const replayed = log.filter((l) => !l.undone).reduce((s, l) => apply(s, l.action), newGame(session.options))
    expect(replayed).toEqual(session.state)
  })
})
