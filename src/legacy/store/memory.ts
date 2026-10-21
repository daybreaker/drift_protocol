import { sortChapters, sortSessions } from '../campaign'
import type { ActionRecord, Campaign, Changes, ChapterRecord, LegacyGameRecord, SessionRecord } from '../records'
import { byRecentUpdate, type LegacyStore } from './store'

/** A store held in memory, for tests. Records are copied in and out, as a real store would. */
export class MemoryStore implements LegacyStore {
  private legacyGames = new Map<string, LegacyGameRecord>()
  private chapters = new Map<string, ChapterRecord>()
  private sessions = new Map<string, SessionRecord>()
  private actions = new Map<string, ActionRecord>()

  async commit(changes: Changes): Promise<void> {
    const copy = structuredClone(changes)
    for (const r of copy.legacy_games ?? []) this.legacyGames.set(r.id, r)
    for (const r of copy.chapters ?? []) this.chapters.set(r.id, r)
    for (const r of copy.sessions ?? []) this.sessions.set(r.id, r)
    for (const r of copy.actions ?? []) this.actions.set(r.id, r)
  }

  async listLegacyGames(): Promise<LegacyGameRecord[]> {
    return structuredClone([...this.legacyGames.values()].sort(byRecentUpdate))
  }

  async loadCampaign(legacyGameId: string): Promise<Campaign | null> {
    const legacyGame = this.legacyGames.get(legacyGameId)
    if (!legacyGame) return null
    return structuredClone({
      legacyGame,
      chapters: sortChapters([...this.chapters.values()].filter((c) => c.legacy_game_id === legacyGameId)),
      sessions: sortSessions([...this.sessions.values()].filter((s) => s.legacy_game_id === legacyGameId)),
    })
  }

  async listActions(sessionId: string): Promise<ActionRecord[]> {
    return structuredClone([...this.actions.values()].filter((a) => a.session_id === sessionId).sort((a, b) => a.seq - b.seq))
  }

  async getAction(id: string): Promise<ActionRecord | null> {
    return structuredClone(this.actions.get(id) ?? null)
  }
}
