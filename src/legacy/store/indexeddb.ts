import { sortChapters, sortSessions } from '../campaign'
import type { ActionRecord, Campaign, Changes, ChapterRecord, LegacyGameRecord, SessionRecord } from '../records'
import { byRecentUpdate, type LegacyStore } from './store'

export const LEGACY_DB_NAME = 'drift-protocol-legacy'
const VERSION = 1
const TABLES = ['legacy_games', 'chapters', 'sessions', 'actions'] as const

/** Opens (creating or upgrading as needed) the browser database that holds the campaign. */
export async function openIndexedDbStore(name = LEGACY_DB_NAME): Promise<LegacyStore> {
  const db = await request(
    (() => {
      const open = indexedDB.open(name, VERSION)
      open.onupgradeneeded = () => {
        const db = open.result
        db.createObjectStore('legacy_games', { keyPath: 'id' })
        db.createObjectStore('chapters', { keyPath: 'id' }).createIndex('legacy_game_id', 'legacy_game_id')
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('legacy_game_id', 'legacy_game_id')
        sessions.createIndex('chapter_id', 'chapter_id')
        const actions = db.createObjectStore('actions', { keyPath: 'id' })
        actions.createIndex('session_id', 'session_id')
        actions.createIndex('session_seq', ['session_id', 'seq'], { unique: true })
      }
      return open
    })(),
  )
  return new IndexedDbStore(db)
}

class IndexedDbStore implements LegacyStore {
  private db: IDBDatabase

  constructor(db: IDBDatabase) {
    this.db = db
  }

  commit(changes: Changes): Promise<void> {
    const tx = this.db.transaction(TABLES, 'readwrite')
    for (const table of TABLES) {
      for (const record of changes[table] ?? []) tx.objectStore(table).put(record)
    }
    return done(tx)
  }

  async listLegacyGames(): Promise<LegacyGameRecord[]> {
    const rows = await request<LegacyGameRecord[]>(this.read('legacy_games').getAll())
    return rows.sort(byRecentUpdate)
  }

  async loadCampaign(legacyGameId: string): Promise<Campaign | null> {
    const tx = this.db.transaction(['legacy_games', 'chapters', 'sessions'], 'readonly')
    const [legacyGame, chapters, sessions] = await Promise.all([
      request<LegacyGameRecord | undefined>(tx.objectStore('legacy_games').get(legacyGameId)),
      request<ChapterRecord[]>(tx.objectStore('chapters').index('legacy_game_id').getAll(legacyGameId)),
      request<SessionRecord[]>(tx.objectStore('sessions').index('legacy_game_id').getAll(legacyGameId)),
    ])
    return legacyGame ? { legacyGame, chapters: sortChapters(chapters), sessions: sortSessions(sessions) } : null
  }

  listActions(sessionId: string): Promise<ActionRecord[]> {
    const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Infinity])
    return request<ActionRecord[]>(this.read('actions').index('session_seq').getAll(range))
  }

  async getAction(id: string): Promise<ActionRecord | null> {
    return (await request<ActionRecord | undefined>(this.read('actions').get(id))) ?? null
  }

  private read(table: (typeof TABLES)[number]): IDBObjectStore {
    return this.db.transaction(table, 'readonly').objectStore(table)
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
