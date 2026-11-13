import { challenge, JUMP_THRESHOLDS, stateMet, SUITS, type Card, type ChallengeSlot, type GameState } from '../engine'

/** How a dealt challenge stands, for the board. */
export function challengeStatus(game: GameState, slot: ChallengeSlot): { complete: boolean; detail: string } {
  const { type, target } = challenge(slot.key)
  if (type === 'tally') return { complete: slot.done, detail: `${slot.progress} of ${target}` }
  if (type === 'feat') return { complete: slot.done, detail: slot.done ? 'Done' : 'Not yet: do it within one turn' }
  const met = stateMet(game, slot.key)
  return { complete: met, detail: `${met ? 'Met now' : 'Not met now'}. Checked when you Jump` }
}

/** The Course half of the Jump check: every suit and the threshold for the next Jump. */
export const courseQualifies = (game: GameState, course: Card[]): boolean =>
  game.jumps < 3 &&
  SUITS.every((s) => course.some((c) => c.suit === s)) &&
  course.reduce((sum, c) => sum + c.rank, 0) >= JUMP_THRESHOLDS[game.jumps]

/** "Space Junk and Clean Sweep" */
export const challengeNames = (slots: ChallengeSlot[]): string => slots.map((s) => challenge(s.key).name).join(' and ')
