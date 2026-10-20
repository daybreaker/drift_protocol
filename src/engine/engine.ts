import { cost, fullDeck, yieldOf } from './cards'
import { IllegalActionError } from './errors'
import { shuffle } from './rng'
import {
  canStationAt,
  emptyPool,
  freshTurnFlags,
  neutralizePayment,
  perkActive,
  salvagePayment,
  systemsOnline,
  takeFromHand,
  draw,
} from './rules'
import { SUITS, type Action, type GameOptions, type GameState, type Side, type Suit } from './types'

export { IllegalActionError }

class NotImplementedError extends Error {
  constructor(name: string) {
    super(`${name} is not implemented yet`)
  }
}

/** A blank board: no cards anywhere, empty pool, Standard options. Used by setup and tests. */
export function emptyState(): GameState {
  return {
    rng: 1,
    turn: 1,
    deck: [],
    hand: [],
    discard: [],
    circuit: [],
    rail: [null, null, null, null, null],
    yard: [],
    threat: [],
    breach: [],
    course: [],
    archive: [],
    modules: {
      power: { stationed: [], capacity: 1 },
      crew: { stationed: [], capacity: 1 },
      data: { stationed: [], capacity: 1 },
      shields: { stationed: [], capacity: 1 },
    },
    pool: emptyPool(),
    turnFlags: freshTurnFlags(),
    calm: true,
    jumps: 0,
    logs: {},
    pending: [],
    options: { breachLimit: 5, jumpBonus: 0 },
    outcome: null,
  }
}

const DIFFICULTY = {
  cadet: { breachLimit: 6, jumpBonus: 0 },
  standard: { breachLimit: 5, jumpBonus: 0 },
  veteran: { breachLimit: 4, jumpBonus: 5 },
} as const

export function newGame(options: GameOptions): GameState {
  const difficulty = options.difficulty ?? 'standard'
  const threes = difficulty === 'cadet' ? SUITS : (options.startingThrees ?? ['power', 'shields'])
  const isStarter = (suit: Suit, rank: number) => rank <= 2 || (rank === 3 && threes.includes(suit))

  const all = fullDeck()
  const s = emptyState()
  s.rng = options.seed | 0
  s.options = { ...DIFFICULTY[difficulty] }
  ;[s.deck, s.rng] = shuffle(all.filter((c) => isStarter(c.suit, c.rank)), s.rng)
  ;[s.yard, s.rng] = shuffle(all.filter((c) => !isStarter(c.suit, c.rank)), s.rng)
  s.rail = s.yard.splice(0, 5)
  draw(s, 5)
  systemsOnline(s)
  return s
}

// ---- Legality -------------------------------------------------------------

const inHand = (s: GameState, cardId: string) => s.hand.some((c) => c.id === cardId)

function canStation(s: GameState, cardId: string, module: Suit): boolean {
  const card = s.hand.find((c) => c.id === cardId)
  return !!card && canStationAt(s, module) && s.pool.crew >= cost(card.rank)
}

const canPlot = (s: GameState, circuitIndex: number) =>
  !!s.circuit[circuitIndex] && !s.circuit[circuitIndex].plotted && s.pool.data >= 2

const canPlotFromHand = (s: GameState, cardId: string) =>
  inHand(s, cardId) && perkActive(s, 'data') && s.pool.data >= 2

const canRecall = (s: GameState, module: Suit, cardId: string) =>
  !s.turnFlags.playedOrSpent && s.modules[module].stationed.some((c) => c.id === cardId)

function isLegal(s: GameState, action: Action): boolean {
  if (s.outcome) return false
  if (s.pending.length > 0) return action.type === 'resolve'
  switch (action.type) {
    case 'playCard':
      return inHand(s, action.cardId)
    case 'salvage':
      return salvagePayment(s, action.railIndex) !== null
    case 'neutralize':
      return neutralizePayment(s, action.threatIndex) !== null
    case 'station':
      return canStation(s, action.cardId, action.module)
    case 'plot':
      return canPlot(s, action.circuitIndex)
    case 'plotFromHand':
      return canPlotFromHand(s, action.cardId)
    case 'recall':
      return canRecall(s, action.module, action.cardId)
    case 'resolve':
      return false
    case 'endTurn':
      return true
  }
}

export function legalActions(state: GameState): Action[] {
  const s = state
  if (s.outcome) return []
  if (s.pending.length > 0) return []

  const actions: Action[] = []
  for (const card of s.hand) {
    actions.push({ type: 'playCard', cardId: card.id, side: 'resource' })
    actions.push({ type: 'playCard', cardId: card.id, side: 'action' })
    for (const module of SUITS) {
      if (canStation(s, card.id, module)) actions.push({ type: 'station', cardId: card.id, module })
    }
    if (canPlotFromHand(s, card.id)) actions.push({ type: 'plotFromHand', cardId: card.id })
  }
  s.rail.forEach((_, railIndex) => {
    if (salvagePayment(s, railIndex)) actions.push({ type: 'salvage', railIndex })
  })
  s.threat.forEach((_, threatIndex) => {
    if (neutralizePayment(s, threatIndex)) {
      actions.push({ type: 'neutralize', threatIndex, keep: 'discard' })
      actions.push({ type: 'neutralize', threatIndex, keep: 'archive' })
    }
  })
  s.circuit.forEach((_, circuitIndex) => {
    if (canPlot(s, circuitIndex)) actions.push({ type: 'plot', circuitIndex })
  })
  for (const module of SUITS) {
    for (const card of s.modules[module].stationed) {
      if (canRecall(s, module, card.id)) actions.push({ type: 'recall', module, cardId: card.id })
    }
  }
  actions.push({ type: 'endTurn' })
  return actions
}

// ---- Applying actions -----------------------------------------------------

/** Puts a hand card into the Circuit and scores Sync, Cascade and resource yield. Returns its Circuit index. */
function place(s: GameState, cardId: string, side: Side): number {
  const card = takeFromHand(s, cardId)
  const prev = s.circuit.at(-1)
  const captain = s.turnFlags.captainNext
  const synced = captain || prev?.card.suit === card.suit
  const cascaded = captain || (prev !== undefined && card.rank === prev.card.rank + 1)

  s.turnFlags.captainNext = false
  s.turnFlags.playedOrSpent = true
  s.circuit.push({ card, side, synced, cascaded, plotted: false })
  if (side === 'resource') s.pool[card.suit] += yieldOf(card.rank) + (synced ? 1 : 0) + s.turnFlags.overdrive
  if (cascaded) s.pool.power += perkActive(s, 'power') ? 2 : 1
  return s.circuit.length - 1
}

export function apply(state: GameState, action: Action): GameState {
  if (!isLegal(state, action)) throw new IllegalActionError(`Illegal action: ${JSON.stringify(action)}`)
  const s = structuredClone(state)

  switch (action.type) {
    case 'playCard': {
      place(s, action.cardId, action.side)
      break
    }
    case 'salvage': {
      s.pool = salvagePayment(s, action.railIndex)!
      s.discard.push(s.rail[action.railIndex]!)
      s.rail[action.railIndex] = null
      if (action.railIndex === 0) s.turnFlags.salvagedAirlock = true
      s.turnFlags.playedOrSpent = true
      break
    }
    case 'neutralize': {
      s.pool = neutralizePayment(s, action.threatIndex)!
      const [card] = s.threat.splice(action.threatIndex, 1)
      ;(action.keep === 'archive' ? s.archive : s.discard).push(card)
      s.turnFlags.playedOrSpent = true
      break
    }
    case 'station': {
      const card = takeFromHand(s, action.cardId)
      s.pool.crew -= cost(card.rank)
      s.modules[action.module].stationed.push(card)
      s.turnFlags.playedOrSpent = true
      break
    }
    case 'plot': {
      s.pool.data -= 2
      s.circuit[action.circuitIndex].plotted = true
      s.turnFlags.playedOrSpent = true
      break
    }
    case 'plotFromHand': {
      s.pool.data -= 2
      s.course.push(takeFromHand(s, action.cardId))
      s.turnFlags.playedOrSpent = true
      break
    }
    case 'recall': {
      // The rulebook: a Module whose card is recalled produces nothing this turn.
      const stationed = s.modules[action.module].stationed
      const i = stationed.findIndex((c) => c.id === action.cardId)
      s.hand.push(...stationed.splice(i, 1))
      s.pool[action.module] = Math.max(0, s.pool[action.module] - s.turnFlags.production[action.module])
      s.turnFlags.production[action.module] = 0
      break
    }
    case 'resolve':
      throw new NotImplementedError('resolve')
    case 'endTurn':
      throw new NotImplementedError('endTurn')
  }
  return s
}

export function previewPlay(state: GameState, cardId: string, side: Side): GameState {
  if (!isLegal(state, { type: 'playCard', cardId, side })) {
    throw new IllegalActionError(`Cannot play ${cardId}`)
  }
  const s = structuredClone(state)
  place(s, cardId, side)
  return s
}
