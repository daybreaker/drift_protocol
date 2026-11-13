import { Game } from './ui/Game'
import { StartScreen } from './ui/StartScreen'
import { useGame } from './ui/useGame'

export default function App() {
  const { session, act, undo, start, quit, setHandOrder, oldRules } = useGame()
  return session ? (
    <Game session={session} act={act} undo={undo} quit={quit} setHandOrder={setHandOrder} />
  ) : (
    <StartScreen
      start={start}
      notice={oldRules ? 'Your saved game was dealt before Jump challenges were added, so it can’t be continued. Start a new game to play with them.' : undefined}
    />
  )
}
