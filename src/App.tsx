import { Game } from './ui/Game'
import { StartScreen } from './ui/StartScreen'
import { useGame } from './ui/useGame'

export default function App() {
  const { session, act, undo, start, quit, setHandOrder } = useGame()
  return session ? (
    <Game session={session} act={act} undo={undo} quit={quit} setHandOrder={setHandOrder} />
  ) : (
    <StartScreen start={start} />
  )
}
