import type { Action, GameOptions, GameState, Suit } from '../engine'

// Records mirror the tables a Rails API would have (docs/legacy/legacy-spec.md § Data model), so their
// fields are snake_case. Ids are client-generated UUIDs and times are ISO 8601 strings.

export type Difficulty = NonNullable<GameOptions['difficulty']>

export interface LegacyGameRecord {
  id: string
  name: string
  difficulty: Difficulty
  /** Null for Cadet, which starts with all four 3s. */
  starting_threes: [Suit, Suit] | null
  credits: number
  current_chapter_id: string
  created_at: string
  updated_at: string
}

export interface ChapterRecord {
  id: string
  legacy_game_id: string
  story_key: string
  /** 1 = the first Story. */
  position: number
  status: 'active' | 'completed'
  started_at: string
  completed_at: string | null
}

export interface SessionRecord {
  id: string
  legacy_game_id: string
  chapter_id: string
  /** 1 = the first try at this chapter. */
  attempt: number
  options: GameOptions
  status: 'in_progress' | 'won' | 'lost'
  score: number | null
  credits_earned: number
  /** The current game. Authoritative; the action log is history. */
  state: GameState
  action_count: number
  /** States since the start of this turn, newest last, for undo. */
  undo_states: GameState[]
  /** The logged action that led from each undo state, in step with `undo_states`. */
  undo_action_ids: string[]
  /** What happened at the end of the previous turn. */
  summary: string[]
  /** The player's arrangement of their hand, by card id. Display only. */
  hand_order: string[]
  started_at: string
  ended_at: string | null
  updated_at: string
}

export interface ActionRecord {
  id: string
  legacy_game_id: string
  chapter_id: string
  session_id: string
  /** 1, 2, 3… within the session. */
  seq: number
  turn: number
  action: Action
  created_at: string
  undone_at: string | null
}

/** Records to insert or replace, by table. A store writes one set in a single transaction. */
export interface Changes {
  legacy_games?: LegacyGameRecord[]
  chapters?: ChapterRecord[]
  sessions?: SessionRecord[]
  actions?: ActionRecord[]
}

/** A legacy game with the records that hang off it, as loaded for the campaign screen. */
export interface Campaign {
  legacyGame: LegacyGameRecord
  chapters: ChapterRecord[]
  sessions: SessionRecord[]
}

/** The clock, id and seed source for the pure campaign functions, so tests can fix them. */
export interface Ctx {
  now: () => string
  newId: () => string
  newSeed: () => number
}
