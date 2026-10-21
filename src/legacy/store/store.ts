import type { ActionRecord, Campaign, Changes, LegacyGameRecord } from '../records'

/**
 * Where legacy records live. Each method maps onto a REST call, so a server-backed store can replace
 * the IndexedDB one: commit is a batch write, the rest are reads.
 */
export interface LegacyStore {
  /** Inserts or replaces every record in `changes`, all or nothing. */
  commit(changes: Changes): Promise<void>
  /** Most recently updated first. */
  listLegacyGames(): Promise<LegacyGameRecord[]>
  /** The legacy game with its chapters (by position) and sessions (by start time). */
  loadCampaign(legacyGameId: string): Promise<Campaign | null>
  /** A session's logged actions, by seq, including undone ones. */
  listActions(sessionId: string): Promise<ActionRecord[]>
  getAction(id: string): Promise<ActionRecord | null>
}

export const byRecentUpdate = (a: LegacyGameRecord, b: LegacyGameRecord) => b.updated_at.localeCompare(a.updated_at)
