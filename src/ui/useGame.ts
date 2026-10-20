import { useCallback, useEffect, useState } from 'react'
import { apply, newGame, type Action, type GameOptions, type GameState } from '../engine'
import { summarizeEndTurn } from './summary'

const KEY = 'drift-protocol:session:v1'

export interface Session {
  game: GameState
  /** States since the start of this turn, newest last, for undo. Cleared when the turn ends. */
  undo: GameState[]
  /** What happened at the end of the previous turn. */
  summary: string[]
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
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
  const [session, setSession] = useState<Session | null>(load)
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

  return { session, act, undo, start, quit }
}
