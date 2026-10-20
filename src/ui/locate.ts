import { SUITS, type Card, type GameState } from '../engine'
import { MODULE_NAME, RAIL_SLOTS } from './text'

/** Where a card is right now, and whether it lies turned (played action side up in the Circuit). */
export function locate(s: GameState, cardId: string): { where?: string; flipped: boolean } {
  const has = (cards: (Card | null)[]) => cards.some((c) => c?.id === cardId)

  const entry = s.circuit.find((e) => e.card.id === cardId)
  if (entry) return { where: 'In the Circuit', flipped: entry.side === 'action' }

  const railIndex = s.rail.findIndex((c) => c?.id === cardId)
  if (railIndex >= 0) return { where: `In the Cargo Rail (${RAIL_SLOTS[railIndex]})`, flipped: false }

  const module = SUITS.find((m) => has(s.modules[m].stationed))
  if (module) return { where: `Stationed at the ${MODULE_NAME[module]}`, flipped: false }

  const zones: [(Card | null)[], string][] = [
    [s.hand, 'In your hand'],
    [s.threat, 'In the Threat zone'],
    [s.course, 'In the Course'],
    [s.deck, 'In your deck'],
    [s.discard, 'In your discard pile'],
    [s.breach, 'In the Breach pile'],
    [s.archive, 'In the Archive'],
    [s.yard, 'In the Salvage Yard'],
  ]
  return { where: zones.find(([cards]) => has(cards))?.[1], flipped: false }
}
