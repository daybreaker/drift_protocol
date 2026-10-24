// Card actions and the decisions they wait on. Like rules.ts, these mutate a draft.
import { yieldOf } from './cards'
import { IllegalActionError } from './errors'
import { canStationAt, draw, production, reshuffle, salvagePayment, takeFromHand } from './rules'
import { isAsteroid, SUITS, type Card, type Decision, type DecisionChoice, type GameState } from './types'

/**
 * Runs the action of `rank` as if played at Circuit position `position`.
 * Engineer passes its own position, so a copied Relay looks at the card before Engineer.
 * In preview mode it applies only what needs no choice and reveals no hidden card: no draws, no decisions.
 */
export function runAction(s: GameState, rank: number, sync: boolean, position: number, preview = false): void {
  const drawN = (n: number) => {
    if (!preview) draw(s, n)
  }
  const ask = (d: Decision) => {
    if (!preview) s.pending.push(d)
  }
  switch (rank) {
    case 1:
      ask({ kind: 'chooseResource', amount: sync ? 2 : 1 })
      break
    case 2:
      s.turnFlags.patchDiscount += 2
      if (sync && s.breach.length > 0) s.yard.push(s.breach.pop()!)
      break
    case 3: {
      if (preview) break
      // Ruling 8: a short deck shows what it has, then the discard is shuffled in under it for the rest.
      const short = s.deck.length < 3 && s.discard.length > 0
      const before = s.deck.length
      if (short) reshuffle(s)
      ask({ kind: 'scan', cards: s.deck.slice(0, 3), drawAfter: sync, ...(short && { reshuffledAfter: before }) })
      break
    }
    case 4:
      ask({ kind: 'chooseCards', purpose: 'jettison', max: sync ? 2 : 1 })
      break
    case 5:
      drawN(sync ? 3 : 2)
      break
    case 6:
      ask({ kind: 'tractorBeam', toHand: sync })
      break
    case 7:
      ask({ kind: 'dock', produceNow: sync })
      break
    case 8: {
      const prev = s.circuit[position - 1]
      if (prev?.side === 'resource') s.pool[prev.card.suit] += yieldOf(prev.card.rank) + (sync ? 1 : 0)
      break
    }
    case 9:
      s.turnFlags.overdrive += 1
      if (sync) drawN(1)
      break
    case 10:
      // With nothing to copy, Engineer does nothing rather than leave an unanswerable decision.
      if (s.circuit.some((_, i) => canCopy(s, position, i))) ask({ kind: 'engineer', sync, engineerIndex: position })
      break
    case 11:
      ask({ kind: 'chooseCards', purpose: 'navigator', max: sync ? 2 : 1 })
      break
    case 12:
      drawN(sync ? 3 : 2)
      s.turnFlags.captainNext = true
      break
  }
}

const canCopy = (s: GameState, engineerIndex: number, i: number) =>
  i !== engineerIndex && !!s.circuit[i] && s.circuit[i].card.rank !== 10

// ---- Choices --------------------------------------------------------------

const unique = (ids: string[]) => new Set(ids).size === ids.length
const sameSet = (a: string[], b: string[]) => a.length === b.length && unique(a) && b.every((id) => a.includes(id))

/** Cards a chooseCards / Log 2B decision may pick from. */
function candidates(s: GameState, purpose: 'jettison' | 'navigator' | 'log2'): Card[] {
  if (purpose === 'navigator') return [...s.circuit.filter((e) => !e.plotted).map((e) => e.card), ...s.discard]
  return [...s.hand, ...s.discard]
}

const validPicks = (s: GameState, purpose: 'jettison' | 'navigator' | 'log2', ids: string[], max: number) => {
  const pool = candidates(s, purpose).map((c) => c.id)
  return ids.length <= max && unique(ids) && ids.every((id) => pool.includes(id))
}

export function isValidChoice(s: GameState, d: Decision, choice: DecisionChoice): boolean {
  switch (d.kind) {
    case 'chooseResource':
      return choice.kind === d.kind && SUITS.includes(choice.suit)
    case 'scan':
      return choice.kind === d.kind && sameSet(d.cards.map((c) => c.id), [...choice.discard, ...choice.order])
    case 'chooseCards':
      return choice.kind === d.kind && validPicks(s, d.purpose, choice.cardIds, d.max)
    case 'tractorBeam':
      return choice.kind === d.kind && (choice.railIndex === null || salvagePayment(s, choice.railIndex, 2) !== null)
    case 'dock':
      return choice.kind === d.kind && (choice.cardId === null || (s.hand.some((c) => c.id === choice.cardId) && canStationAt(s, choice.module)))
    case 'engineer':
      return choice.kind === d.kind && canCopy(s, d.engineerIndex, choice.circuitIndex)
    case 'log1':
      return choice.kind === d.kind && (choice.option === 'B' || SUITS.includes(choice.module))
    case 'log2':
      if (choice.kind !== d.kind) return false
      if (choice.option === 'B') return validPicks(s, 'log2', choice.archive, 3)
      return choice.railIndices[0] !== choice.railIndices[1] && choice.railIndices.every((i) => takeable(s, i))
  }
}

type DecisionOf<K extends Decision['kind']> = Extract<Decision, { kind: K }>

/** Answers the first pending decision. */
export function resolveDecision(s: GameState, choice: DecisionChoice): void {
  const d = s.pending[0]
  if (!d || !isValidChoice(s, d, choice)) throw new IllegalActionError(`Invalid choice: ${JSON.stringify(choice)}`)
  s.pending.shift()

  switch (choice.kind) {
    case 'chooseResource':
      s.pool[choice.suit] += (d as DecisionOf<'chooseResource'>).amount
      break
    case 'scan': {
      const seen = s.deck.splice(0, choice.discard.length + choice.order.length)
      const byId = (id: string) => seen.find((c) => c.id === id)!
      s.discard.push(...choice.discard.map(byId))
      s.deck.unshift(...choice.order.map(byId))
      if ((d as DecisionOf<'scan'>).drawAfter) draw(s, 1)
      break
    }
    case 'chooseCards': {
      const purpose = (d as DecisionOf<'chooseCards'>).purpose
      for (const id of choice.cardIds) {
        if (purpose === 'jettison') {
          s.archive.push(takeFromHandOrDiscard(s, id))
          s.pool.power += 1
        } else {
          const e = s.circuit.find((x) => x.card.id === id && !x.plotted)
          if (e) e.plotted = true
          else s.course.push(takeFromDiscard(s, id))
        }
      }
      break
    }
    case 'tractorBeam': {
      if (choice.railIndex === null) break
      s.pool = salvagePayment(s, choice.railIndex, 2)!
      const card = s.rail[choice.railIndex] as Card // salvagePayment ruled out an Asteroid
      s.rail[choice.railIndex] = null
      if (choice.railIndex === 0) s.turnFlags.salvagedAirlock = true
      if ((d as DecisionOf<'tractorBeam'>).toHand) s.hand.push(card)
      else s.deck.unshift(card)
      break
    }
    case 'dock': {
      if (choice.cardId === null) break
      s.modules[choice.module].stationed.push(takeFromHand(s, choice.cardId))
      if ((d as DecisionOf<'dock'>).produceNow) s.pool[choice.module] += production(s, choice.module)
      break
    }
    case 'engineer': {
      const { sync, engineerIndex } = d as DecisionOf<'engineer'>
      runAction(s, s.circuit[choice.circuitIndex].card.rank, sync, engineerIndex)
      break
    }
    case 'log1':
      if (choice.option === 'A') s.modules[choice.module].capacity = 2
      else s.yard.push(...s.breach.splice(0))
      s.logs.log1 = choice.option
      break
    case 'log2':
      if (choice.option === 'A') {
        for (const i of choice.railIndices) {
          s.hand.push(s.rail[i] as Card) // isValidChoice ruled out an Asteroid
          s.rail[i] = null
        }
      } else {
        for (const id of choice.archive) s.archive.push(takeFromHandOrDiscard(s, id))
      }
      s.logs.log2 = choice.option
      break
  }
}

function takeFromDiscard(s: GameState, id: string): Card {
  return s.discard.splice(s.discard.findIndex((c) => c.id === id), 1)[0]
}

function takeFromHandOrDiscard(s: GameState, id: string): Card {
  return s.hand.some((c) => c.id === id) ? takeFromHand(s, id) : takeFromDiscard(s, id)
}

// ---- Enumerating choices for legalActions ---------------------------------

function subsets<T>(items: T[], max: number): T[][] {
  const out: T[][] = [[]]
  const walk = (start: number, picked: T[]) => {
    for (let i = start; i < items.length && picked.length < max; i++) {
      const next = [...picked, items[i]]
      out.push(next)
      walk(i + 1, next)
    }
  }
  walk(0, [])
  return out
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]))
}

/** Every valid answer to a decision. Unordered picks are listed once, in candidate order. */
export function choicesFor(s: GameState, d: Decision): DecisionChoice[] {
  const all = ((): DecisionChoice[] => {
    switch (d.kind) {
      case 'chooseResource':
        return SUITS.map((suit) => ({ kind: d.kind, suit }))
      case 'scan': {
        const ids = d.cards.map((c) => c.id)
        return subsets(ids, ids.length).flatMap((discard) =>
          permutations(ids.filter((id) => !discard.includes(id))).map((order) => ({ kind: d.kind, discard, order })),
        )
      }
      case 'chooseCards':
        return subsets(candidates(s, d.purpose).map((c) => c.id), d.max).map((cardIds) => ({ kind: d.kind, cardIds }))
      case 'tractorBeam':
        return [{ kind: d.kind, railIndex: null }, ...s.rail.map((_, railIndex) => ({ kind: d.kind, railIndex }))]
      case 'dock':
        return [
          { kind: d.kind, cardId: null },
          ...s.hand.flatMap((c) => SUITS.map((module) => ({ kind: d.kind, cardId: c.id, module }))),
        ]
      case 'engineer':
        return s.circuit.map((_, circuitIndex) => ({ kind: d.kind, circuitIndex }))
      case 'log1':
        return [{ kind: d.kind, option: 'B' }, ...SUITS.map((module) => ({ kind: d.kind, option: 'A' as const, module }))]
      case 'log2': {
        const pairs = subsets([0, 1, 2, 3, 4], 2).filter((p) => p.length === 2) as [number, number][]
        return [
          ...pairs.map((railIndices) => ({ kind: d.kind, option: 'A' as const, railIndices })),
          ...subsets(candidates(s, 'log2').map((c) => c.id), 3).map((archive) => ({ kind: d.kind, option: 'B' as const, archive })),
        ]
      }
    }
  })()
  return all.filter((choice) => isValidChoice(s, d, choice))
}

/** A Rail slot holding a card Log 2A can take: any numbered card, never an Asteroid. */
function takeable(s: GameState, railIndex: number): boolean {
  const card = s.rail[railIndex]
  return !!card && !isAsteroid(card)
}
