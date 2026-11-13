// Jump challenges (Ruling 23): one per Jump, two on Veteran. Like rules.ts, helpers that change state mutate a draft.
import { cost, JUMP_THRESHOLDS } from './cards'
import { isStaffed } from './rules'
import { SUITS, type ChallengeKey, type ChallengeSlot, type GameState } from './types'

export type { ChallengeKey }

export type ChallengeType = 'state' | 'tally' | 'feat'

export interface Challenge {
  key: ChallengeKey
  /** Printed number, 1–24. */
  number: number
  name: string
  type: ChallengeType
  /** How many a Tally needs. */
  target?: number
  /** What completes it, in the player's words. */
  text: string
}

export const CHALLENGES: readonly Challenge[] = [
  { key: 'full-crew', number: 1, name: 'Full Crew', type: 'state', text: 'All 4 Modules staffed.' },
  { key: 'twin-stations', number: 2, name: 'Twin Stations', type: 'state', text: '2 Modules each staffed with a card of their own suit.' },
  { key: 'clean-hull', number: 3, name: 'Clean Hull', type: 'state', text: 'Breach holds 1 card or fewer.' },
  { key: 'quiet-sky', number: 4, name: 'Quiet Sky', type: 'state', text: 'No hazard hits at Impact on the Jump turn.' },
  { key: 'lean-ship', number: 5, name: 'Lean Ship', type: 'state', text: 'Deck, hand and discard hold 15 cards or fewer.' },
  { key: 'deep-course', number: 6, name: 'Deep Course', type: 'state', text: "Course rank at least the Jump's threshold + 5." },
  { key: 'balanced-course', number: 7, name: 'Balanced Course', type: 'state', text: 'At least 2 Course cards of every suit.' },
  { key: 'officer-corps', number: 8, name: 'Officer Corps', type: 'state', text: '3 Course cards of rank 9+.' },
  { key: 'space-junk', number: 9, name: 'Space Junk', type: 'tally', target: 4, text: 'Neutralize and Archive 4 hazards.' },
  { key: 'scrap-run', number: 10, name: 'Scrap Run', type: 'tally', target: 6, text: 'Archive 6 of your own cards (Scrap, Jettison, Log 2B).' },
  { key: 'hazard-bounty', number: 11, name: 'Hazard Bounty', type: 'tally', target: 3, text: 'Neutralize 3 Cost 5 hazards.' },
  { key: 'airlock-rescue', number: 12, name: 'Airlock Rescue', type: 'tally', target: 3, text: 'Salvage 3 cards from the Airlock.' },
  { key: 'recruitment-drive', number: 13, name: 'Recruitment Drive', type: 'tally', target: 3, text: 'Station 3 cards.' },
  { key: 'signal-boost', number: 14, name: 'Signal Boost', type: 'tally', target: 3, text: 'Plot 3 cards by paying Data.' },
  { key: 'hull-repair', number: 15, name: 'Hull Repair', type: 'tally', target: 2, text: 'Move 2 Breach cards to the Yard.' },
  { key: 'heavy-salvage', number: 16, name: 'Heavy Salvage', type: 'tally', target: 3, text: 'Salvage 3 Cost 5 cards.' },
  { key: 'long-circuit', number: 17, name: 'Long Circuit', type: 'feat', text: 'Play 6 cards in one turn.' },
  { key: 'cascade-run', number: 18, name: 'Cascade Run', type: 'feat', text: '3 Cascades in one turn.' },
  { key: 'full-sync', number: 19, name: 'Full Sync', type: 'feat', text: '4 cards of one suit in a row.' },
  { key: 'overclock', number: 20, name: 'Overclock', type: 'feat', text: '10 resources unspent at once.' },
  { key: 'spectrum', number: 21, name: 'Spectrum', type: 'feat', text: 'One card of each suit played resource side up in one turn.' },
  { key: 'bridge-crew', number: 22, name: 'Bridge Crew', type: 'feat', text: 'A 10, an 11 and a 12 in one turn.' },
  { key: 'clean-sweep', number: 23, name: 'Clean Sweep', type: 'feat', text: 'Neutralize 2 hazards in one turn.' },
  { key: 'salvage-spree', number: 24, name: 'Salvage Spree', type: 'feat', text: 'Salvage 3 cards in one turn.' },
]

export const challenge = (key: ChallengeKey): Challenge => CHALLENGES.find((x) => x.key === key)!

export const newSlot = (key: ChallengeKey): ChallengeSlot => ({ key, progress: 0, done: false })

/** The challenges the next Jump needs. Empty once all three Jumps are made. */
export const activeChallenges = (s: GameState): ChallengeSlot[] => s.challenges[s.jumps] ?? []

/** Counts `n` toward an active Tally challenge, up to its target. */
export function tally(s: GameState, key: ChallengeKey, n = 1): void {
  const target = challenge(key).target!
  for (const slot of activeChallenges(s)) {
    if (slot.key !== key || n <= 0) continue
    slot.progress = Math.min(target, slot.progress + n)
    slot.done = slot.progress >= target
  }
}

/** Whether a Feat's condition holds on the board right now. */
function featMet(s: GameState, key: ChallengeKey): boolean {
  const circuit = s.circuit
  switch (key) {
    case 'long-circuit':
      return circuit.length >= 6
    case 'cascade-run':
      return circuit.filter((e) => e.cascaded).length >= 3
    case 'full-sync':
      return circuit.some((_, i) => i >= 3 && [1, 2, 3].every((k) => circuit[i - k].card.suit === circuit[i].card.suit))
    case 'overclock':
      return SUITS.reduce((sum, suit) => sum + s.pool[suit], 0) >= 10
    case 'spectrum':
      return SUITS.every((suit) => circuit.some((e) => e.side === 'resource' && e.card.suit === suit))
    case 'bridge-crew':
      return [10, 11, 12].every((rank) => circuit.some((e) => e.card.rank === rank))
    case 'clean-sweep':
      return s.turnFlags.neutralizes >= 2
    case 'salvage-spree':
      return s.turnFlags.salvages >= 3
    default:
      return false
  }
}

/** Marks active Feats done once their condition holds. Runs after every action and after Systems Online. */
export function checkFeats(s: GameState): void {
  for (const slot of activeChallenges(s)) {
    if (!slot.done && challenge(slot.key).type === 'feat' && featMet(s, slot.key)) slot.done = true
  }
}

/**
 * Whether a State challenge holds now. `hits` is how many hazards hit at Impact this turn;
 * before Impact (as the board shows it), Quiet Sky holds while the Threat zone is empty.
 */
export function stateMet(s: GameState, key: ChallengeKey, hits = s.threat.length): boolean {
  const course = s.course
  switch (key) {
    case 'full-crew':
      return SUITS.every((m) => isStaffed(s, m))
    case 'twin-stations':
      return SUITS.filter((m) => s.modules[m].stationed.some((c) => c.suit === m)).length >= 2
    case 'clean-hull':
      return s.breach.length <= 1
    case 'quiet-sky':
      return hits === 0
    case 'lean-ship':
      return s.deck.length + s.hand.length + s.discard.length <= 15
    case 'deep-course':
      return course.reduce((sum, c) => sum + c.rank, 0) >= JUMP_THRESHOLDS[s.jumps] + 5
    case 'balanced-course':
      return SUITS.every((suit) => course.filter((c) => c.suit === suit).length >= 2)
    case 'officer-corps':
      return course.filter((c) => c.rank >= 9).length >= 3
    default:
      return false
  }
}

/** Whether one dealt challenge is complete: State challenges are judged now, the others by their record. */
export const slotComplete = (s: GameState, slot: ChallengeSlot, hits?: number): boolean =>
  challenge(slot.key).type === 'state' ? stateMet(s, slot.key, hits) : slot.done

/** The Jump check's challenge half: every active challenge complete. */
export const challengesComplete = (s: GameState, hits: number): boolean => activeChallenges(s).every((slot) => slotComplete(s, slot, hits))

/** Hazards neutralized for Space Junk, Hazard Bounty and Clean Sweep. */
export function recordNeutralize(s: GameState, printedCost: number, archived: boolean): void {
  s.turnFlags.neutralizes += 1
  if (archived) tally(s, 'space-junk')
  if (printedCost === 5) tally(s, 'hazard-bounty')
}

/** A card salvaged (by Salvage or Tractor Beam) for Airlock Rescue, Heavy Salvage and Salvage Spree. */
export function recordSalvage(s: GameState, railIndex: number, rank: number): void {
  s.turnFlags.salvages += 1
  if (railIndex === 0) tally(s, 'airlock-rescue')
  if (cost(rank) === 5) tally(s, 'heavy-salvage')
}
