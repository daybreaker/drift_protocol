import { apply, newGame, type Action } from '../engine'
import { summarizeEndTurn } from '../ui/summary'
import type { ActionRecord, Campaign, Changes, ChapterRecord, Ctx, LegacyGameRecord, SessionRecord } from './records'
import { storyAt } from './stories'

export class LegacyRuleError extends Error {}

export interface NewLegacyGame {
  name: string
  difficulty: LegacyGameRecord['difficulty']
  starting_threes: LegacyGameRecord['starting_threes']
}

/** A new legacy game and the chapter for its first Story. */
export function createLegacyGame(input: NewLegacyGame, ctx: Ctx): Changes {
  const now = ctx.now()
  const legacyGameId = ctx.newId()
  const chapter = openChapter(legacyGameId, 1, now, ctx)
  const legacyGame: LegacyGameRecord = {
    id: legacyGameId,
    name: input.name,
    difficulty: input.difficulty,
    starting_threes: input.difficulty === 'cadet' ? null : input.starting_threes,
    credits: 0,
    current_chapter_id: chapter.id,
    created_at: now,
    updated_at: now,
  }
  return { legacy_games: [legacyGame], chapters: [chapter] }
}

/** A new Session for the current chapter, played with the campaign's settings and a new seed. */
export function startSession(campaign: Campaign, ctx: Ctx): Changes {
  const { legacyGame } = campaign
  const chapter = currentChapter(campaign)
  if (chapter.status === 'completed') throw new LegacyRuleError('This chapter is complete.')
  const tries = campaign.sessions.filter((s) => s.chapter_id === chapter.id)
  if (tries.some((s) => s.status === 'in_progress')) throw new LegacyRuleError('A Session is already in progress.')
  const now = ctx.now()
  const options = {
    seed: ctx.newSeed(),
    difficulty: legacyGame.difficulty,
    ...(legacyGame.starting_threes ? { startingThrees: legacyGame.starting_threes } : {}),
  }
  const session: SessionRecord = {
    id: ctx.newId(),
    legacy_game_id: legacyGame.id,
    chapter_id: chapter.id,
    attempt: tries.length + 1,
    options,
    status: 'in_progress',
    score: null,
    credits_earned: 0,
    state: newGame(options),
    action_count: 0,
    undo_states: [],
    undo_action_ids: [],
    summary: [],
    hand_order: [],
    started_at: now,
    ended_at: null,
    updated_at: now,
  }
  return { sessions: [session] }
}

/**
 * Applies an action to a Session and logs it. If the game ends, the Session is finished too: a win
 * turns the score into Credits, completes the chapter and opens the next Story's chapter.
 */
export function recordAction(campaign: Campaign, session: SessionRecord, action: Action, ctx: Ctx): Changes {
  if (session.status !== 'in_progress') throw new LegacyRuleError('This Session has ended.')
  const state = apply(session.state, action)
  const now = ctx.now()
  const logged: ActionRecord = {
    id: ctx.newId(),
    legacy_game_id: session.legacy_game_id,
    chapter_id: session.chapter_id,
    session_id: session.id,
    seq: session.action_count + 1,
    turn: session.state.turn,
    action,
    created_at: now,
    undone_at: null,
  }
  const endOfTurn = action.type === 'endTurn'
  const next: SessionRecord = {
    ...session,
    state,
    action_count: logged.seq,
    undo_states: endOfTurn ? [] : [...session.undo_states, session.state],
    undo_action_ids: endOfTurn ? [] : [...session.undo_action_ids, logged.id],
    summary: endOfTurn ? summarizeEndTurn(session.state, state) : session.summary,
    updated_at: now,
  }
  if (!state.outcome) return { sessions: [next], actions: [logged] }
  return { ...finishSession(campaign, next, now, ctx), actions: [logged] }
}

function finishSession(campaign: Campaign, session: SessionRecord, now: string, ctx: Ctx): Changes {
  const outcome = session.state.outcome!
  const ended: SessionRecord = { ...session, undo_states: [], undo_action_ids: [], ended_at: now }
  if (outcome.result === 'lost') return { sessions: [{ ...ended, status: 'lost', score: null, credits_earned: 0 }] }

  const chapter = campaign.chapters.find((c) => c.id === session.chapter_id)!
  const completed: ChapterRecord = { ...chapter, status: 'completed', completed_at: now }
  const following = storyAt(chapter.position + 1) ? openChapter(campaign.legacyGame.id, chapter.position + 1, now, ctx) : null
  const legacyGame: LegacyGameRecord = {
    ...campaign.legacyGame,
    credits: campaign.legacyGame.credits + outcome.score,
    current_chapter_id: following?.id ?? chapter.id,
    updated_at: now,
  }
  return {
    legacy_games: [legacyGame],
    chapters: following ? [completed, following] : [completed],
    sessions: [{ ...ended, status: 'won', score: outcome.score, credits_earned: outcome.score }],
  }
}

/** Steps back over the most recent action this turn. The action stays in the log, marked undone. */
export function undoAction(session: SessionRecord, last: ActionRecord, ctx: Ctx): Changes {
  if (session.status !== 'in_progress' || session.undo_action_ids.at(-1) !== last.id) {
    throw new LegacyRuleError('Only the most recent action this turn can be undone.')
  }
  const now = ctx.now()
  return {
    sessions: [{
      ...session,
      state: session.undo_states.at(-1)!,
      undo_states: session.undo_states.slice(0, -1),
      undo_action_ids: session.undo_action_ids.slice(0, -1),
      updated_at: now,
    }],
    actions: [{ ...last, undone_at: now }],
  }
}

export function setHandOrder(session: SessionRecord, handOrder: string[], ctx: Ctx): Changes {
  return { sessions: [{ ...session, hand_order: handOrder, updated_at: ctx.now() }] }
}

export function currentChapter(campaign: Campaign): ChapterRecord {
  return campaign.chapters.find((c) => c.id === campaign.legacyGame.current_chapter_id)!
}

/** The Session in progress for the current chapter, if there is one. */
export function activeSession(campaign: Campaign): SessionRecord | undefined {
  return campaign.sessions.find((s) => s.chapter_id === campaign.legacyGame.current_chapter_id && s.status === 'in_progress')
}

/**
 * Folds a set of changes into a loaded campaign (or builds one from a new legacy game), in the same
 * order a store loads them: chapters by position, sessions by start time.
 */
export function mergeChanges(campaign: Campaign | null, changes: Changes): Campaign {
  const legacyGame = changes.legacy_games?.[0] ?? campaign?.legacyGame
  if (!legacyGame) throw new LegacyRuleError('No legacy game to merge into.')
  return {
    legacyGame,
    chapters: sortChapters(upsert(campaign?.chapters ?? [], changes.chapters)),
    sessions: sortSessions(upsert(campaign?.sessions ?? [], changes.sessions)),
  }
}

export const sortChapters = (rows: ChapterRecord[]) => [...rows].sort((a, b) => a.position - b.position)
export const sortSessions = (rows: SessionRecord[]) =>
  [...rows].sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id.localeCompare(b.id))

function upsert<T extends { id: string }>(rows: T[], changed: T[] | undefined): T[] {
  if (!changed) return rows
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const r of changed) byId.set(r.id, r)
  return [...byId.values()]
}

function openChapter(legacyGameId: string, position: number, now: string, ctx: Ctx): ChapterRecord {
  return {
    id: ctx.newId(),
    legacy_game_id: legacyGameId,
    story_key: storyAt(position)!.key,
    position,
    status: 'active',
    started_at: now,
    completed_at: null,
  }
}
