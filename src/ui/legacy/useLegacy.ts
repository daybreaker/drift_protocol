import { useCallback, useEffect, useRef, useState } from 'react'
import type { Action } from '../../engine'
import {
  createLegacyGame,
  mergeChanges,
  openIndexedDbStore,
  recordAction,
  setHandOrder as setHandOrderChange,
  startSession,
  undoAction,
  type Campaign,
  type Changes,
  type Ctx,
  type LegacyGameRecord,
  type LegacyStore,
  type NewLegacyGame,
} from '../../legacy'

export const browserCtx: Ctx = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
  newSeed: () => Math.floor(Math.random() * 2 ** 31),
}

let opening: Promise<LegacyStore> | null = null

/** The browser's campaign database, opened once per page load. */
export function useLegacyStore(): { store: LegacyStore | null; error: string | null } {
  const [store, setStore] = useState<LegacyStore | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    try {
      opening ??= openIndexedDbStore()
    } catch (e) {
      opening = Promise.reject(e)
    }
    opening.then(
      (s) => live && setStore(s),
      () => live && setError('Legacy campaigns are saved in browser storage, which this browser window does not allow.'),
    )
    return () => {
      live = false
    }
  }, [])
  return { store, error }
}

export function useLegacyGames(store: LegacyStore | null): LegacyGameRecord[] | null {
  const [games, setGames] = useState<LegacyGameRecord[] | null>(null)
  useEffect(() => {
    let live = true
    store?.listLegacyGames().then((g) => live && setGames(g))
    return () => {
      live = false
    }
  }, [store])
  return games
}

/** Saves a new campaign and returns its id. Also asks the browser not to evict the campaign database. */
export async function createCampaign(store: LegacyStore, input: NewLegacyGame): Promise<string> {
  const changes = createLegacyGame(input, browserCtx)
  await store.commit(changes)
  void navigator.storage?.persist?.()
  return changes.legacy_games![0].id
}

/**
 * One loaded campaign. Every change is computed from the latest campaign in memory, shown at once,
 * and written to the store in order, so quick clicks never act on stale records.
 */
export function useCampaign(store: LegacyStore, legacyGameId: string) {
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef<Campaign | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    let live = true
    store.loadCampaign(legacyGameId).then(
      (c) => {
        if (!live) return
        latest.current = c
        setCampaign(c)
        if (!c) setError('That campaign could not be found.')
      },
      (e) => live && setError(`The campaign could not be loaded: ${String(e)}`),
    )
    return () => {
      live = false
    }
  }, [store, legacyGameId])

  const run = useCallback(
    (change: (c: Campaign) => Changes | null | Promise<Changes | null>): Promise<Campaign | null> => {
      const step = queue.current.then(async () => {
        const current = latest.current
        if (!current) return null
        const changes = await change(current)
        if (!changes) return current
        const next = mergeChanges(current, changes)
        latest.current = next
        setCampaign(next)
        await store.commit(changes)
        return next
      })
      queue.current = step.catch((e) => setError(`Your last move could not be saved: ${String(e)}`))
      return step.catch(() => null)
    },
    [store],
  )

  const sessionIn = (c: Campaign, sessionId: string) => c.sessions.find((s) => s.id === sessionId && s.status === 'in_progress')

  /** Starts a Session for the current chapter and resolves to its id. */
  const start = useCallback(
    async () => {
      const before = new Set(latest.current?.sessions.map((s) => s.id))
      const next = await run((c) => startSession(c, browserCtx))
      return next?.sessions.find((s) => !before.has(s.id))?.id ?? null
    },
    [run],
  )

  const act = useCallback(
    (sessionId: string, action: Action) => {
      void run((c) => {
        const session = sessionIn(c, sessionId)
        return session ? recordAction(c, session, action, browserCtx) : null
      })
    },
    [run],
  )

  const undo = useCallback(
    (sessionId: string) => {
      void run(async (c) => {
        const session = sessionIn(c, sessionId)
        const lastId = session?.undo_action_ids.at(-1)
        const last = lastId ? await store.getAction(lastId) : null
        return session && last ? undoAction(session, last, browserCtx) : null
      })
    },
    [run, store],
  )

  const setHandOrder = useCallback(
    (sessionId: string, ids: string[]) => {
      void run((c) => {
        const session = sessionIn(c, sessionId)
        return session ? setHandOrderChange(session, ids, browserCtx) : null
      })
    },
    [run],
  )

  return { campaign, error, start, act, undo, setHandOrder }
}
