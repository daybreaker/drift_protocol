import { useState } from 'react'
import { Game } from './ui/Game'
import { LegacyApp } from './ui/legacy/LegacyApp'
import { useLegacyStore } from './ui/legacy/useLegacy'
import { StartScreen } from './ui/StartScreen'
import { useGame } from './ui/useGame'

export default function App() {
  const { session, act, undo, start, quit, setHandOrder, oldRules } = useGame()
  const legacy = useLegacyStore()
  const [legacyGameId, setLegacyGameId] = useState<string | null>(null)

  if (session) return <Game session={session} act={act} undo={undo} quit={quit} setHandOrder={setHandOrder} />
  if (legacyGameId && legacy.store) {
    return <LegacyApp store={legacy.store} legacyGameId={legacyGameId} leave={() => setLegacyGameId(null)} />
  }
  return (
    <StartScreen
      start={start}
      legacy={legacy}
      openCampaign={setLegacyGameId}
      notice={oldRules ? 'Your saved game was dealt before Jump challenges were added, so it can’t be continued. Start a new game to play with them.' : undefined}
    />
  )
}
