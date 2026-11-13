import { useCallback, useEffect, useState } from 'react'
import { apply, newGame, type Action, type GameOptions, type GameState } from '../engine'
import { summarizeEndTurn } from './summary'

const KEY = 'drift-protocol:session:v1'
/** Where a save from older rules is kept when it can no longer be played, rather than deleting it. */
const OLD_RULES_KEY = 'drift-protocol:session:old-rules'

export interface Session {
  game: GameState
  /** States since the start of this turn, newest last, for undo. Cleared when the turn ends. */
  undo: GameState[]
  /** What happened at the end of the previous turn. */
  summary: string[]
  /** The player's arrangement of their hand, by card id. Display only. */
  handOrder?: string[]
}

/** A save from before Jump challenges (Ruling 23) has no challenges and can't be played on. */
const isCurrent = (session: Session) => Array.isArray(session.game?.challenges)

function load(): { session: Session | null; oldRules: boolean } {
  try {
    const raw = localStorage.getItem(KEY)
    const session = raw ? (JSON.parse(raw) as Session) : null
    if (raw && session && !isCurrent(session)) {
      localStorage.setItem(OLD_RULES_KEY, raw)
      return { session: null, oldRules: true }
    }
    return { session, oldRules: false }
  } catch {
    return { session: null, oldRules: false }
  }
}

function save(session: Session | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage can be unavailable (private windows, blocked site data); the game still works without it.
  }
}

export function useGame() {
  const [loaded] = useState(load)
  const [session, setSession] = useState<Session | null>(loaded.session)
  useEffect(() => save(session), [session])

  const act = useCallback(
    (action: Action) => {
      if (!session) return
      const next = apply(session.game, action)
      setSession(
        action.type === 'endTurn'
          ? { game: next, undo: [], summary: summarizeEndTurn(session.game, next) }
          : { ...session, game: next, undo: [...session.undo, session.game] },
      )
    },
    [session],
  )

  const undo = useCallback(() => {
    if (!session || session.undo.length === 0) return
    setSession({ ...session, game: session.undo.at(-1)!, undo: session.undo.slice(0, -1) })
  }, [session])

  const start = useCallback((options: GameOptions) => {
    setSession({ game: newGame(options), undo: [], summary: [] })
  }, [])

  const quit = useCallback(() => setSession(null), [])

  const setHandOrder = useCallback((handOrder: string[]) => setSession((s) => (s ? { ...s, handOrder } : s)), [])

  /** True when a saved game was set aside because it predates the current rules. */
  const oldRules = loaded.oldRules
  return { session, act, undo, start, quit, setHandOrder, oldRules }
}
