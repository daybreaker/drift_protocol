import { useState } from 'react'
import { makeCard, SUITS, type GameOptions, type Suit } from '../engine'
import type { LegacyGameRecord, LegacyStore } from '../legacy'
import { SuitIcon } from './Card'
import { createCampaign, useLegacyGames } from './legacy/useLegacy'
import { cardImage, SUIT_NAME } from './text'

type Difficulty = NonNullable<GameOptions['difficulty']>
type Mode = 'standard' | 'legacy'

const DIFFICULTIES: { id: Difficulty; name: string; detail: string }[] = [
  { id: 'cadet', name: 'Cadet', detail: 'Start with all four 3s. The hull fails at 6 Breach cards.' },
  { id: 'standard', name: 'Standard', detail: 'Start with two 3s of your choice. The hull fails at 5 Breach cards.' },
  { id: 'veteran', name: 'Veteran', detail: 'The hull fails at 4 Breach cards, and each Jump needs 5 more rank.' },
]

const NEW = 'new'

interface Props {
  start: (options: GameOptions) => void
  legacy: { store: LegacyStore | null; error: string | null }
  openCampaign: (legacyGameId: string) => void
}

export function StartScreen({ start, legacy, openCampaign }: Props) {
  const [mode, setMode] = useState<Mode>('standard')
  const [difficulty, setDifficulty] = useState<Difficulty>('standard')
  const [threes, setThrees] = useState<Suit[]>(['power', 'shields'])
  const [seed, setSeed] = useState('')
  const games = useLegacyGames(legacy.store)
  const [picked, setPicked] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const campaignId = picked ?? games?.[0]?.id ?? NEW
  const creating = mode === 'legacy' && campaignId === NEW
  const showSetup = mode === 'standard' || creating

  const toggleThree = (s: Suit) =>
    setThrees(threes.includes(s) ? threes.filter((x) => x !== s) : [...threes, s].slice(-2))
  const threesReady = difficulty === 'cadet' || threes.length === 2
  const startingThrees: [Suit, Suit] | null = difficulty === 'cadet' ? null : [threes[0], threes[1]]

  const launch = async () => {
    if (mode === 'standard') {
      const parsed = Number.parseInt(seed, 10)
      start({
        seed: Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 2 ** 31),
        difficulty,
        startingThrees: startingThrees ?? undefined,
      })
      return
    }
    if (!creating) return openCampaign(campaignId)
    if (!legacy.store) return
    setBusy(true)
    const id = await createCampaign(legacy.store, {
      name: name.trim() || defaultName(games ?? []),
      difficulty,
      starting_threes: startingThrees,
    })
    openCampaign(id)
  }

  const ready = mode === 'standard' ? threesReady : !!legacy.store && !busy && (!creating || threesReady)
  const label = mode === 'standard' ? 'Start game' : creating ? 'Start campaign' : 'Continue campaign'

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
        <legend>Game</legend>
        <div className="choice-list">
          <label className="choice">
            <input type="radio" name="mode" checked={mode === 'standard'} onChange={() => setMode('standard')} />
            <span>
              <b>Standard game</b>
              <span className="muted">One game, start to finish.</span>
            </span>
          </label>
          <label className="choice">
            <input type="radio" name="mode" checked={mode === 'legacy'} onChange={() => setMode('legacy')} />
            <span>
              <b>Legacy campaign</b>
              <span className="muted">A story told over many games. Each win opens the next Story, and your progress is saved between games.</span>
            </span>
          </label>
        </div>
      </fieldset>

      {mode === 'legacy' && (
        <fieldset className="start-field">
          <legend>Campaign</legend>
          {legacy.error ? (
            <p className="tray-problem">{legacy.error}</p>
          ) : (
            <div className="choice-list">
              {(games ?? []).map((g) => (
                <label key={g.id} className="choice">
                  <input type="radio" name="campaign" checked={campaignId === g.id} onChange={() => setPicked(g.id)} />
                  <span>
                    <b>{g.name}</b>
                    <span className="muted">{campaignDetail(g)}</span>
                  </span>
                </label>
              ))}
              <label className="choice">
                <input type="radio" name="campaign" checked={campaignId === NEW} onChange={() => setPicked(NEW)} />
                <span>
                  <b>New campaign</b>
                  <span className="muted">Difficulty and starting 3s are set once, for the whole campaign.</span>
                </span>
              </label>
            </div>
          )}
          {creating && !legacy.error && (
            <label className="field">
              <span>Ship's name for this campaign</span>
              <input className="seed text-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={defaultName(games ?? [])} />
            </label>
          )}
        </fieldset>
      )}

      {showSetup && (
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
      )}

      {showSetup && difficulty !== 'cadet' && (
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

      {mode === 'standard' && (
        <fieldset className="start-field">
          <legend>Seed</legend>
          <p className="muted">Leave blank for a random game, or enter a number to replay a deal.</p>
          <input className="seed" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} placeholder="Random" aria-label="Seed" />
        </fieldset>
      )}

      <button type="button" className="btn btn-primary btn-launch" disabled={!ready} onClick={launch}>
        {label}
      </button>
    </main>
  )
}

function campaignDetail(g: LegacyGameRecord): string {
  const started = new Date(g.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const difficulty = DIFFICULTIES.find((d) => d.id === g.difficulty)!.name
  return `${difficulty}. ${g.credits} Credits. Started ${started}.`
}

function defaultName(games: LegacyGameRecord[]): string {
  return games.length === 0 ? 'Halcyon' : `Halcyon ${games.length + 1}`
}
