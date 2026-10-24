// End of turn: Impact, Drift, Cleanup (with the Jump check), then the next turn's Systems Online.
// Mutates a draft, like rules.ts.
import { cost, JUMP_THRESHOLDS } from './cards'
import { breachLimit, draw, emptyPool, freshTurnFlags, isStaffed, perkActive, systemsOnline } from './rules'
import { isAsteroid, SUITS, type FieldCard, type GameState } from './types'

export function endTurn(s: GameState): void {
  // Impact
  s.breach.push(...s.threat.splice(0))
  if (s.breach.length >= breachLimit(s)) {
    s.outcome = { result: 'lost', reason: 'breach' }
    return
  }

  // Drift
  const vent = (i: number) => {
    const card = s.rail[i]
    if (!card) return
    s.rail[i] = null
    const debris = !isAsteroid(card) && (s.calm || cost(card.rank) === 2)
    ;(debris ? s.archive : s.threat).push(card)
  }
  if (!s.turnFlags.salvagedAirlock) vent(0)
  if (s.logs.log2 === 'A') vent(1)
  const rail = s.rail.filter((c): c is FieldCard => c !== null)
  while (rail.length < 5) {
    const next = s.yard.shift()
    if (!next) {
      s.rail = [...rail, ...Array<null>(5 - rail.length).fill(null)]
      s.outcome = { result: 'lost', reason: 'yard' }
      return
    }
    rail.push(next)
  }
  s.rail = rail

  // Cleanup
  for (const e of s.circuit) (e.plotted ? s.course : s.discard).push(e.card)
  s.circuit = []
  s.discard.push(...s.hand.splice(0))
  draw(s, perkActive(s, 'crew') ? 6 : 5)
  jumpCheck(s)

  s.turn += 1
  s.pool = emptyPool()
  s.turnFlags = freshTurnFlags()
  if (!s.outcome) systemsOnline(s)
}

function jumpCheck(s: GameState): void {
  const needed = JUMP_THRESHOLDS[s.jumps] + s.options.jumpBonus
  const total = s.course.reduce((sum, c) => sum + c.rank, 0)
  if (!SUITS.every((suit) => s.course.some((c) => c.suit === suit)) || total < needed) return

  s.archive.push(...s.course.splice(0), ...s.threat.splice(0))
  s.jumps += 1
  if (s.jumps === 1) s.pending.push({ kind: 'log1' })
  else if (s.jumps === 2) s.pending.push({ kind: 'log2' })
  else s.outcome = { result: 'won', score: score(s) }
}

/** Yard size + 3 per staffed Module − 2 per Breach card. */
const score = (s: GameState): number =>
  s.yard.length + 3 * SUITS.filter((m) => isStaffed(s, m)).length - 2 * s.breach.length
