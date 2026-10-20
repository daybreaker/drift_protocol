import { ACTION_NAMES, type Card, type Suit } from '../engine'

export const SUIT_NAME: Record<Suit, string> = { power: 'Power', crew: 'Crew', data: 'Data', shields: 'Shields' }

export const MODULE_NAME: Record<Suit, string> = {
  power: 'Reactor',
  crew: 'Quarters',
  data: 'Nav Core',
  shields: 'Shield Array',
}

export const MODULE_PERK: Record<Suit, string> = {
  power: 'Cascades give 2 Power',
  crew: 'Draw 6 at cleanup',
  data: 'Plot straight from your hand',
  shields: 'Breach limit +1',
}

/** Cargo Rail slot names by engine index; cards slide toward the Airlock. */
export const RAIL_SLOTS = ['Airlock', 'Inner Lock', 'Rail', 'Rail', 'Intake'] as const

/** Rail slots in screen order, left to right: the Intake first, the Airlock last, next to the Threat zone it vents into. */
export const railLeftToRight = <T,>(rail: T[]): [T, number][] => rail.map((x, i): [T, number] => [x, i]).reverse()

/** The wild resource for each kind of payment. */
export const WILD = { salvage: 'power', neutralize: 'shields' } as const

export const cardName = (c: Card): string => `${SUIT_NAME[c.suit]} ${c.rank}`
export const actionName = (c: Card): string => ACTION_NAMES[c.rank]

const base = import.meta.env?.BASE_URL ?? '/'
export const cardImage = (c: Card): string => `${base}cards/${SUIT_NAME[c.suit]}-${String(c.rank).padStart(2, '0')}.jpg`
export const moduleImage = (m: Suit): string => `${base}cards/Module-${MODULE_NAME[m].replace(' ', '')}.jpg`

/** "Data 12", "Data 12 and Crew 9", "Data 12, Crew 9 and Power 6". */
export function listCards(cards: Card[]): string {
  const names = cards.map(cardName)
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** "3 Data and 2 Power". */
export function listAmounts(amounts: Partial<Record<Suit, number>>): string {
  const parts = Object.entries(amounts)
    .filter(([, n]) => n && n > 0)
    .map(([suit, n]) => `${n} ${SUIT_NAME[suit as Suit]}`)
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}
