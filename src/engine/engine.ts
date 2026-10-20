import type { Action, GameOptions, GameState, Side } from './types'

export class IllegalActionError extends Error {}

class NotImplementedError extends Error {
  constructor(name: string) {
    super(`${name} is not implemented yet`)
  }
}

/** A blank board: no cards anywhere, empty pool, Standard options. Used by setup and tests. */
export function emptyState(): GameState {
  const zero = { power: 0, crew: 0, data: 0, shields: 0 }
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
    pool: { ...zero },
    turnFlags: {
      overdrive: 0,
      captainNext: false,
      patchDiscount: 0,
      salvagedAirlock: false,
      playedOrSpent: false,
      production: { ...zero },
    },
    calm: true,
    jumps: 0,
    logs: {},
    pending: [],
    options: { breachLimit: 5, jumpBonus: 0 },
    outcome: null,
  }
}

export function newGame(_options: GameOptions): GameState {
  throw new NotImplementedError('newGame')
}

export function legalActions(_state: GameState): Action[] {
  throw new NotImplementedError('legalActions')
}

export function apply(_state: GameState, _action: Action): GameState {
  throw new NotImplementedError('apply')
}

export function previewPlay(_state: GameState, _cardId: string, _side: Side): GameState {
  throw new NotImplementedError('previewPlay')
}
