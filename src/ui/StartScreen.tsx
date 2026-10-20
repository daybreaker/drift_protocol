import { useState } from 'react'
import { makeCard, SUITS, type GameOptions, type Suit } from '../engine'
import { SuitIcon } from './Card'
import { cardImage, SUIT_NAME } from './text'

type Difficulty = NonNullable<GameOptions['difficulty']>

const DIFFICULTIES: { id: Difficulty; name: string; detail: string }[] = [
  { id: 'cadet', name: 'Cadet', detail: 'Start with all four 3s. The hull fails at 6 Breach cards.' },
  { id: 'standard', name: 'Standard', detail: 'Start with two 3s of your choice. The hull fails at 5 Breach cards.' },
  { id: 'veteran', name: 'Veteran', detail: 'The hull fails at 4 Breach cards, and each Jump needs 5 more rank.' },
]

export function StartScreen({ start }: { start: (options: GameOptions) => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>('standard')
  const [threes, setThrees] = useState<Suit[]>(['power', 'shields'])
  const [seed, setSeed] = useState('')

  const toggleThree = (s: Suit) =>
    setThrees(threes.includes(s) ? threes.filter((x) => x !== s) : [...threes, s].slice(-2))
  const ready = difficulty === 'cadet' || threes.length === 2

  const launch = () => {
    const parsed = Number.parseInt(seed, 10)
    start({
      seed: Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 2 ** 31),
      difficulty,
      startingThrees: difficulty === 'cadet' ? undefined : [threes[0], threes[1]],
    })
  }

  return (
    <main className="start">
      <div className="start-cards" aria-hidden="true">
        <img src={cardImage(makeCard('data', 9))} alt="" />
        <img src={cardImage(makeCard('power', 12))} alt="" />
        <img src={cardImage(makeCard('crew', 5))} alt="" />
      </div>
      <h1>Drift Protocol</h1>
      <p className="start-premise">
        You are WREN, the maintenance intelligence of the derelict colony ship <i>Halcyon</i>, sliding into a dying star.
        Make three Jumps before the hull fails or the salvage field runs dry.
      </p>

      <fieldset className="start-field">
        <legend>Difficulty</legend>
        <div className="choice-list">
          {DIFFICULTIES.map((d) => (
            <label key={d.id} className="choice">
              <input type="radio" name="difficulty" checked={difficulty === d.id} onChange={() => setDifficulty(d.id)} />
              <span>
                <b>{d.name}</b>
                <span className="muted">{d.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {difficulty !== 'cadet' && (
        <fieldset className="start-field">
          <legend>Starting 3s</legend>
          <p className="muted">Pick two. Power and Shields are wild, which makes them the easier start.</p>
          <div className="choice-row">
            {SUITS.map((s) => (
              <label key={s} className="chip" data-suit={s}>
                <input type="checkbox" checked={threes.includes(s)} onChange={() => toggleThree(s)} />
                <SuitIcon suit={s} size={16} /> {SUIT_NAME[s]} 3
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="start-field">
        <legend>Seed</legend>
        <p className="muted">Leave blank for a random game, or enter a number to replay a deal.</p>
        <input className="seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} placeholder="Random" aria-label="Seed" />
      </fieldset>

      <button type="button" className="btn btn-primary btn-launch" disabled={!ready} onClick={launch}>
        Start game
      </button>
    </main>
  )
}
