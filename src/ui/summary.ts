import { activeChallenges, challenge, cost, isAsteroid, isStaffed, type FieldCard, type GameState } from '../engine'
import { challengeNames, courseQualifies } from './challenges'
import { cardName, listAmounts, listCards } from './text'

/** Plain-language lines describing what happened during an endTurn, from the states either side of it. */
export function summarizeEndTurn(before: GameState, after: GameState): string[] {
  const lines: string[] = []

  if (before.threat.length > 0) {
    // Ruling 16: the Shield Array's +1 is checked once the hazards have moved, so only staffing matters.
    const limit = before.options.breachLimit + (isStaffed(before, 'shields') ? 1 : 0)
    lines.push(`${listCards(before.threat)} hit the hull. Breach ${after.breach.length} of ${limit}.`)
  }
  if (after.outcome?.result === 'lost' && after.outcome.reason === 'breach') return lines

  const vented: [FieldCard | null, string][] = []
  if (!before.turnFlags.salvagedAirlock) vented.push([before.rail[0], 'Airlock'])
  if (before.logs.log2 === 'A') vented.push([before.rail[1], 'Inner Lock'])
  for (const [card, slot] of vented) {
    if (!card) continue
    const hazard = isAsteroid(card) || (!before.calm && cost(card.rank) !== 2)
    lines.push(hazard ? `${cardName(card)} drifted out of the ${slot} and is now a hazard.` : `${cardName(card)} drifted out of the ${slot} as debris.`)
  }
  if (after.outcome?.result === 'lost') return lines

  if (before.calm && !after.calm) lines.push('Your deck ran out and the discard pile was reshuffled. Calm start is over.')
  if (after.jumps > before.jumps) {
    lines.push(`Jump ${after.jumps} complete.`)
    const next = activeChallenges(after)
    if (next.length > 0) lines.push(`Jump ${after.jumps + 1} needs ${next.map((s) => `${challenge(s.key).name}: ${challenge(s.key).text}`).join(' Also ')}`)
  } else if (courseQualifies(after, after.course)) {
    lines.push(`The Course is ready, but Jump ${after.jumps + 1} still needs ${challengeNames(activeChallenges(after))}.`)
  }
  const produced = listAmounts(after.turnFlags.production)
  if (produced) lines.push(`Modules produced ${produced}.`)
  return lines
}
