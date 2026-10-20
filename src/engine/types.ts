export type Suit = 'power' | 'crew' | 'data' | 'shields'
export type Side = 'resource' | 'action'

export const SUITS: readonly Suit[] = ['power', 'crew', 'data', 'shields']

export interface Card {
  /** Stable id, e.g. "data-08". */
  id: string
  suit: Suit
  rank: number
}

export interface CircuitEntry {
  card: Card
  side: Side
  synced: boolean
  cascaded: boolean
  plotted: boolean
}

export interface ModuleSlot {
  stationed: Card[]
  capacity: number
}

export type Pool = Record<Suit, number>

export interface TurnFlags {
  /** Number of Overdrives played this turn; each adds +1 to later resource plays. */
  overdrive: number
  captainNext: boolean
  patchDiscount: number
  salvagedAirlock: boolean
  /** True once any card is played or anything is spent this turn (ends the recall window). */
  playedOrSpent: boolean
  /** What Systems Online produced this turn, per Module, so a recall can refund it. */
  production: Pool
}

export type Decision =
  | { kind: 'chooseResource'; amount: number }
  | { kind: 'scan'; cards: Card[]; drawAfter: boolean }
  | { kind: 'chooseCards'; purpose: 'jettison' | 'navigator'; max: number }
  | { kind: 'tractorBeam'; toHand: boolean }
  | { kind: 'dock'; produceNow: boolean }
  | { kind: 'engineer'; sync: boolean; engineerIndex: number }
  | { kind: 'log1' }
  | { kind: 'log2' }

export type DecisionChoice =
  | { kind: 'chooseResource'; suit: Suit }
  | { kind: 'scan'; discard: string[]; order: string[] }
  | { kind: 'chooseCards'; cardIds: string[] }
  | { kind: 'tractorBeam'; railIndex: number | null }
  | { kind: 'dock'; cardId: string; module: Suit } | { kind: 'dock'; cardId: null }
  | { kind: 'engineer'; circuitIndex: number }
  | { kind: 'log1'; option: 'A'; module: Suit } | { kind: 'log1'; option: 'B' }
  | { kind: 'log2'; option: 'A'; railIndices: [number, number] } | { kind: 'log2'; option: 'B'; archive: string[] }

export type Outcome = null | { result: 'won'; score: number } | { result: 'lost'; reason: 'breach' | 'yard' }

export interface GameOptions {
  seed: number
  difficulty?: 'cadet' | 'standard' | 'veteran'
  /** Suits of the two starting 3s (Standard and Veteran). Default: power and shields. */
  startingThrees?: [Suit, Suit]
}

export interface GameState {
  rng: number
  turn: number
  /** index 0 = top */
  deck: Card[]
  hand: Card[]
  discard: Card[]
  circuit: CircuitEntry[]
  /** length 5; 0 = Airlock, 1 = Inner Lock, 2–3 = Rail, 4 = Intake */
  rail: (Card | null)[]
  /** index 0 = top */
  yard: Card[]
  threat: Card[]
  /** last element = top */
  breach: Card[]
  course: Card[]
  archive: Card[]
  modules: Record<Suit, ModuleSlot>
  pool: Pool
  turnFlags: TurnFlags
  calm: boolean
  jumps: number
  logs: { log1?: 'A' | 'B'; log2?: 'A' | 'B' }
  pending: Decision[]
  options: { breachLimit: number; jumpBonus: number }
  outcome: Outcome
}

export type Action =
  | { type: 'playCard'; cardId: string; side: Side }
  | { type: 'salvage'; railIndex: number }
  | { type: 'neutralize'; threatIndex: number; keep: 'discard' | 'archive' }
  | { type: 'station'; cardId: string; module: Suit }
  | { type: 'plot'; circuitIndex: number }
  | { type: 'plotFromHand'; cardId: string }
  | { type: 'recall'; module: Suit; cardId: string }
  | { type: 'resolve'; choice: DecisionChoice }
  | { type: 'endTurn' }
