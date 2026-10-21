import { useState, type ReactNode } from 'react'
import { breachLimit, isOnline, isStaffed, JUMP_THRESHOLDS, perkActive, SUITS, type Card, type GameState, type Suit } from '../engine'
import { CardView, SuitIcon } from './Card'
import { MODULE_NAME, MODULE_PERK, SUIT_NAME } from './text'

export function Zone({ area, title, note, tone, children }: { area: string; title: string; note?: string; tone?: 'danger'; children: ReactNode }) {
  return (
    <section className={`zone zone-${area}`} style={{ gridArea: area }} data-tone={tone}>
      <h2 className="zone-title">{title}</h2>
      {children}
      {note && <p className="zone-note">{note}</p>}
    </section>
  )
}

/** How a game is left: a standard game is abandoned (after a confirm); a legacy Session is kept and left. */
export interface Exit {
  /** Status bar button that leaves without abandoning, e.g. "Campaign". */
  button: string
  /** Outcome dialog button, e.g. "Back to campaign". */
  outcome: string
}

export function StatusBar({ game, canUndo, undo, quit, exit }: { game: GameState; canUndo: boolean; undo: () => void; quit: () => void; exit?: Exit }) {
  const [confirming, setConfirming] = useState(false)
  const limit = breachLimit(game)
  return (
    <header className="status">
      <span className="wordmark">Drift Protocol</span>
      <span className="stat"><b>Turn {game.turn}</b></span>
      <span className="stat" aria-label={`${game.jumps} of 3 Jumps made`}>
        Jumps
        <span className="pips">
          {[0, 1, 2].map((i) => <span key={i} className={`pip pip-jump ${i < game.jumps ? 'is-on' : ''}`} />)}
        </span>
      </span>
      <span className="stat" aria-label={`Breach ${game.breach.length} of ${limit}`} data-tone={game.breach.length >= limit - 1 ? 'danger' : undefined}>
        Breach
        <span className="pips">
          {Array.from({ length: limit }, (_, i) => <span key={i} className={`pip pip-breach ${i < game.breach.length ? 'is-on' : ''}`} />)}
        </span>
        <b>{game.breach.length}/{limit}</b>
      </span>
      <PileStat label="Deck" cards={game.deck} />
      <PileStat label="Discard" cards={game.discard} />
      <span className="stat">Yard <b>{game.yard.length}</b></span>
      <span className="stat">Archive <b>{game.archive.length}</b></span>
      <span className="status-actions">
        <button type="button" className="btn btn-small" disabled={!canUndo} onClick={undo}>Undo</button>
        {exit ? (
          <button type="button" className="btn btn-small" onClick={quit}>{exit.button}</button>
        ) : confirming ? (
          <>
            <button type="button" className="btn btn-small btn-danger" onClick={quit}>Abandon this game</button>
            <button type="button" className="btn btn-small" onClick={() => setConfirming(false)}>Keep playing</button>
          </>
        ) : (
          <button type="button" className="btn btn-small" onClick={() => (game.outcome ? quit() : setConfirming(true))}>New game</button>
        )}
      </span>
    </header>
  )
}

/** A pile count that shows its suit breakdown on hover or focus. */
function PileStat({ label, cards }: { label: string; cards: Card[] }) {
  const id = `pile-${label.toLowerCase()}`
  return (
    <span className="stat has-tip" tabIndex={0} aria-describedby={id}>
      {label} <b>{cards.length}</b>
      <span className="tip" role="tooltip" id={id}>
        {cards.length === 0 ? (
          <span className="muted">Empty</span>
        ) : (
          SUITS.map((s) => {
            const n = cards.filter((c) => c.suit === s).length
            return (
              <span key={s} className="tip-row" data-suit={s} data-empty={n === 0}>
                <SuitIcon suit={s} size={14} /> {SUIT_NAME[s]} <b>{n}</b>
              </span>
            )
          })
        )}
      </span>
    </span>
  )
}

export function ModuleTile({ game, module: m, station, stationCost }: {
  game: GameState
  module: Suit
  station?: () => void
  stationCost: number
}) {
  const slot = game.modules[m]
  const online = isOnline(game, m)
  const staffed = isStaffed(game, m)
  const produced = game.turnFlags.production[m]
  const status = !online
    ? `Offline: a ${SUIT_NAME[m]} hazard is in the Threat zone`
    : staffed
      ? produced > 0 ? `Produced ${produced} ${SUIT_NAME[m]} this turn` : `Produces ${SUIT_NAME[m]} each turn`
      : `Empty: station a card here to produce ${SUIT_NAME[m]}`
  return (
    <div className="module" data-suit={m} data-online={online}>
      <div className="module-band">
        <SuitIcon suit={m} size={18} />
        <span className="module-name">{MODULE_NAME[m]}</span>
      </div>
      <div className="module-slots">
        {slot.stationed.map((card) => <CardView key={card.id} card={card} size="xs" tucked />)}
        {Array.from({ length: slot.capacity - slot.stationed.length }, (_, i) => (
          <div key={i} className="empty-slot card-xs is-tucked">Open</div>
        ))}
      </div>
      <p className="module-status">{status}</p>
      <p className="module-perk" data-active={perkActive(game, m)}>{MODULE_PERK[m]}</p>
      {station && (
        <button type="button" className="btn btn-small btn-primary" onClick={station}>
          Station here for {stationCost} Crew
        </button>
      )}
    </div>
  )
}

export function Course({ game, view }: { game: GameState; view: GameState }) {
  if (game.jumps >= 3) return <p className="empty-note">All three Jumps made.</p>
  const needed = JUMP_THRESHOLDS[game.jumps] + game.options.jumpBonus
  const plotted = view.circuit.filter((e) => e.plotted).map((e) => e.card)
  const committed = [...game.course, ...plotted]
  const total = committed.reduce((sum, c) => sum + c.rank, 0)
  const ready = total >= needed && SUITS.every((s) => committed.some((c) => c.suit === s))
  return (
    <div className="course">
      <div className="course-progress">
        <span className="course-total"><b>{total}</b> of {needed} rank</span>
        <span className="course-suits">
          {SUITS.map((s) => (
            <span key={s} data-have={committed.some((c) => c.suit === s)} title={SUIT_NAME[s]}>
              <SuitIcon suit={s} size={16} outline={!committed.some((c) => c.suit === s)} />
            </span>
          ))}
        </span>
      </div>
      <p className="muted">
        {ready
          ? `Ready: you Jump at the end of this turn (Jump ${game.jumps + 1}).`
          : `Jump ${game.jumps + 1} needs every suit and ${needed}+ total rank.`}
        {plotted.length > 0 && ` Includes ${plotted.length} plotted this turn.`}
      </p>
      <div className="row course-cards">
        {game.course.map((card) => <CardView key={card.id} card={card} size="xs" />)}
      </div>
    </div>
  )
}

export function Pool({ game, view }: { game: GameState; view: GameState }) {
  const f = view.turnFlags
  const effects = [
    f.overdrive > 0 && `Overdrive: resource plays yield +${f.overdrive}`,
    f.patchDiscount > 0 && `Patch: neutralizing costs ${f.patchDiscount} less`,
    f.captainNext && 'Captain: your next card counts as Synced and Cascaded',
    game.logs.log2 === 'B' && 'Running silent: neutralizing costs 1 more',
  ].filter(Boolean) as string[]
  return (
    <div className="pool" aria-label="Resources this turn">
      {SUITS.map((s) => {
        const delta = view.pool[s] - game.pool[s]
        return (
          <div key={s} className="pool-row" data-suit={s} data-empty={view.pool[s] === 0}>
            <SuitIcon suit={s} size={18} />
            <span className="pool-name">{SUIT_NAME[s]}</span>
            <b className="pool-value">{view.pool[s]}</b>
            {delta > 0 && <span className="pool-delta">+{delta}</span>}
          </div>
        )
      })}
      {effects.map((e) => <p key={e} className="pool-effect">{e}</p>)}
    </div>
  )
}

export function Outcome({ game, quit, exit }: { game: GameState; quit: () => void; exit?: Exit }) {
  const o = game.outcome!
  const staffed = SUITS.filter((m) => isStaffed(game, m)).length
  return (
    <div className="outcome" role="dialog" aria-modal="true" aria-labelledby="outcome-title">
      <div className="outcome-box">
        {o.result === 'won' ? (
          <>
            <h2 id="outcome-title">Clear sky</h2>
            <p>The third Jump carried the Halcyon out of the star's pull.</p>
            <p className="score"><b>{o.score}</b> points</p>
            <p className="muted">
              {game.yard.length} left in the Salvage Yard, plus {3 * staffed} for {staffed} staffed {staffed === 1 ? 'Module' : 'Modules'}, minus {2 * game.breach.length} for {game.breach.length} Breach {game.breach.length === 1 ? 'card' : 'cards'}.
            </p>
          </>
        ) : (
          <>
            <h2 id="outcome-title">Hull lost</h2>
            <p>
              {o.reason === 'breach'
                ? `The Breach pile reached ${game.breach.length} cards and the hull failed.`
                : 'The Salvage Yard ran dry before the Cargo Rail could refill.'}
            </p>
            <p className="muted">You made {game.jumps} of 3 Jumps in {game.turn} turns.</p>
          </>
        )}
        <button type="button" className="btn btn-primary" onClick={quit}>{exit?.outcome ?? 'New game'}</button>
      </div>
    </div>
  )
}
