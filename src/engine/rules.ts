// Queries and state helpers shared by the engine. Helpers that change state mutate a draft:
// `apply` clones its input once and only ever works on that copy.
import { ASTEROID_COST, cost, yieldOf } from './cards'
import { shuffle } from './rng'
import { isAsteroid, SUITS, type Card, type GameState, type Pool, type Suit, type TurnFlags } from './types'

export const emptyPool = (): Pool => ({ power: 0, crew: 0, data: 0, shields: 0 })

export function freshTurnFlags(): TurnFlags {
  return {
    overdrive: 0,
    captainNext: false,
    patchDiscount: 0,
    salvagedAirlock: false,
    playedOrSpent: false,
    production: emptyPool(),
  }
}

/** A Module is offline while any Threat card shares its suit. Asteroids have no suit. */
export const isOnline = (s: GameState, module: Suit): boolean => !s.threat.some((c) => !isAsteroid(c) && c.suit === module)

export const isStaffed = (s: GameState, module: Suit): boolean => s.modules[module].stationed.length > 0

/** Perks need the Module staffed and online. */
export const perkActive = (s: GameState, module: Suit): boolean => isStaffed(s, module) && isOnline(s, module)

/** Online and below capacity. */
export const canStationAt = (s: GameState, module: Suit): boolean =>
  isOnline(s, module) && s.modules[module].stationed.length < s.modules[module].capacity

export const breachLimit = (s: GameState): number => s.options.breachLimit + (perkActive(s, 'shields') ? 1 : 0)

/**
 * Pays `amount` from the pool, exact suit first and then the wild (if any).
 * Returns the new pool, or null if the pool cannot pay.
 */
export function pay(pool: Pool, amount: number, suit: Suit, wild?: Suit): Pool | null {
  const fromSuit = Math.min(pool[suit], amount)
  const rest = amount - fromSuit
  if (rest === 0) return { ...pool, [suit]: pool[suit] - fromSuit }
  if (!wild || wild === suit || pool[wild] < rest) return null
  return { ...pool, [suit]: pool[suit] - fromSuit, [wild]: pool[wild] - rest }
}

const SLOT_DISCOUNT = [2, 1, 0, 0, 0]

/** Salvage cost of a Rail slot; `extraDiscount` is Tractor Beam's −2. Null if empty or an Asteroid. */
export function salvageCost(s: GameState, railIndex: number, extraDiscount = 0): number | null {
  const card = s.rail[railIndex]
  if (!card || isAsteroid(card)) return null
  return Math.max(0, cost(card.rank) - SLOT_DISCOUNT[railIndex] - extraDiscount)
}

export function salvagePayment(s: GameState, railIndex: number, extraDiscount = 0): Pool | null {
  const card = s.rail[railIndex]
  const amount = salvageCost(s, railIndex, extraDiscount)
  if (!card || isAsteroid(card) || amount === null) return null
  return pay(s.pool, amount, card.suit, 'power')
}

/** Extra cost to take a neutralized hazard into the discard pile instead of archiving it (Ruling 17). */
export const KEEP_SURCHARGE = 2

/** Null if there is no such hazard, or for keeping an Asteroid, which can only be archived. */
export function neutralizeCost(s: GameState, threatIndex: number, keep: 'discard' | 'archive'): number | null {
  const card = s.threat[threatIndex]
  if (!card || (isAsteroid(card) && keep === 'discard')) return null
  const printed = isAsteroid(card) ? ASTEROID_COST : cost(card.rank)
  const base = Math.max(0, printed - s.turnFlags.patchDiscount) + (s.logs.log2 === 'B' ? 1 : 0)
  return base + (keep === 'discard' ? KEEP_SURCHARGE : 0)
}

export function neutralizePayment(s: GameState, threatIndex: number, keep: 'discard' | 'archive'): Pool | null {
  const card = s.threat[threatIndex]
  const amount = neutralizeCost(s, threatIndex, keep)
  if (!card || amount === null) return null
  return isAsteroid(card) ? pay(s.pool, amount, 'shields') : pay(s.pool, amount, card.suit, 'shields')
}

/** Shuffles the discard pile in under the deck. The first reshuffle ends calm start. */
export function reshuffle(s: GameState): void {
  if (s.discard.length === 0) return
  const [shuffled, rng] = shuffle(s.discard, s.rng)
  s.deck = [...s.deck, ...shuffled]
  s.rng = rng
  s.discard = []
  s.calm = false
}

/** Draws up to n cards, reshuffling the discard when the deck runs out. */
export function draw(s: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    if (s.deck.length === 0) reshuffle(s)
    if (s.deck.length === 0) return
    s.hand.push(s.deck.shift()!)
  }
}

/** What a Module produces from its stationed cards: yield each, +1 when the suit matches. */
export const production = (s: GameState, module: Suit): number =>
  s.modules[module].stationed.reduce((sum, c) => sum + yieldOf(c.rank) + (c.suit === module ? 1 : 0), 0)

export function systemsOnline(s: GameState): void {
  for (const module of SUITS) {
    const amount = isOnline(s, module) ? production(s, module) : 0
    s.pool[module] += amount
    s.turnFlags.production[module] = amount
  }
}

export function takeFromHand(s: GameState, cardId: string): Card {
  const i = s.hand.findIndex((c) => c.id === cardId)
  return s.hand.splice(i, 1)[0]
}
