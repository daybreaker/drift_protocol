# Drift Protocol — Engine Spec

The rules engine is pure TypeScript with no UI. Every rule lives here; the React app only renders state and sends actions.

Source of truth for the rules: the Drift Protocol rulebook in Notion ([DRIFT PROTOCOL](https://app.notion.com/p/3ff7f436dffd813aba57def170b1571e) › Rules). Where the rulebook is silent, the **Rulings** section below decides.

## Core contract

```ts
newGame(options) → GameState
legalActions(state) → Action[]
apply(state, action) → GameState        // pure: never mutates its input
previewPlay(state, cardId, side) → GameState   // placement only, no effects
```

- **Pure and immutable.** `apply` returns a new state. The UI's tentative placement is just `previewPlay(state, …)` rendered; OK sends `playCard`, Cancel discards the preview.
- **Seeded RNG.** All shuffles use the RNG state stored in `GameState`, so a seed plus an action log replays a game exactly.
- **Illegal actions throw.** `apply` throws `IllegalActionError` for any action not in `legalActions(state)`.

## Cards

48 numbered cards: ranks 1–12 in four suits. Modules are not cards in the engine; they are fixed slots.

| Suit | Resource | Wild for |
| --- | --- | --- |
| power | Power | salvaging any card |
| crew | Crew | — |
| data | Data | — |
| shields | Shields | neutralizing any hazard |

| Ranks | Yield | Cost |
| --- | --- | --- |
| 1–4 | 1 | 2 |
| 5–8 | 2 | 3 |
| 9–12 | 3 | 5 |

| Rank | Action | Base | Sync |
| --- | --- | --- | --- |
| 1 | Scrounge | Gain 1 of a chosen resource | Gain 2 of a chosen resource |
| 2 | Patch | Neutralizing costs 2 less this turn | Also move the top Breach card to the bottom of the Yard |
| 3 | Scan | Look at top 3 of deck; discard any, return the rest in any order | Then draw 1 |
| 4 | Jettison | Archive up to 1 card from hand or discard; +1 Power per card | Up to 2 cards |
| 5 | Recruit | Draw 2 | Draw 3 |
| 6 | Tractor Beam | Salvage 1 Rail card for 2 less; it goes on top of your deck | It goes to your hand |
| 7 | Dock | Station a card from hand at a Module for free | That Module produces now |
| 8 | Relay | Gain the previous card's printed yield again, in its resource | +1 to that |
| 9 | Overdrive | Every resource play after this one this turn yields +1 | Also draw 1 |
| 10 | Engineer | Copy another Circuit card's base action | Copy its Sync effect |
| 11 | Navigator | Plot up to 1 card from Circuit or discard, free | Up to 2 |
| 12 | Captain | Draw 2; the next card counts as Synced and Cascaded | Draw 3 |

## State

```ts
type Suit = 'power' | 'crew' | 'data' | 'shields'
type Side = 'resource' | 'action'
interface Card { id: string; suit: Suit; rank: number }   // id like "data-08"

interface CircuitEntry { card: Card; side: Side; synced: boolean; cascaded: boolean; plotted: boolean }

interface GameState {
  rng: number                       // RNG state
  turn: number
  deck: Card[]                      // index 0 = top
  hand: Card[]
  discard: Card[]
  circuit: CircuitEntry[]
  rail: (Card | null)[]             // length 5; index 0 = Airlock, 1 = Inner Lock, 2–3 = Rail, 4 = Intake
  yard: Card[]                      // index 0 = top
  threat: Card[]
  breach: Card[]                    // last element = top
  course: Card[]
  archive: Card[]
  modules: Record<Suit, { stationed: Card[]; capacity: number }>
  pool: Record<Suit, number>        // resources this turn
  turnFlags: { overdrive: number; captainNext: boolean; patchDiscount: number; salvagedAirlock: boolean; playedOrSpent: boolean; production: Record<Suit, number> }
  calm: boolean                     // true until the first reshuffle
  jumps: number                     // 0–3
  logs: { log1?: 'A' | 'B'; log2?: 'A' | 'B' }
  pending: Decision[]               // choices waiting on the player; actions other than `resolve` are illegal while non-empty
  options: { breachLimit: number; jumpBonus: number }
  outcome: null | { result: 'won' } | { result: 'lost'; reason: 'breach' | 'yard' }
}
```

## Actions

| Action | Legal when |
| --- | --- |
| `{ type: 'playCard', cardId, side }` | card in hand; no pending decisions |
| `{ type: 'salvage', railIndex }` | rail slot occupied; pool can pay |
| `{ type: 'neutralize', threatIndex, keep: 'discard' \| 'archive' }` | pool can pay |
| `{ type: 'station', cardId, module }` | card in hand; Module online and below capacity; enough Crew |
| `{ type: 'plot', circuitIndex }` / `{ type: 'plotFromHand', cardId }` | 2 Data; not already plotted; from hand only with Nav Core staffed and online |
| `{ type: 'recall', module, cardId }` | before the first play or spend this turn |
| `{ type: 'resolve', decisionId, choice }` | answers the first pending decision |
| `{ type: 'endTurn' }` | no pending decisions |

## Turn sequence

1. **Systems Online** (start of turn, automatic). Each online Module produces, for each stationed card, its yield, +1 if its suit matches the Module. Production is recorded in `turnFlags.production` so `recall` can refund it.
2. **Operate.** The player sends actions until `endTurn`.
3. **Impact.** All Threat cards move to Breach. If Breach ≥ limit → lost (`breach`).
4. **Drift.** Unless the Airlock card was salvaged this turn, vent `rail[0]`. With Log 2A, also vent `rail[1]`. A vented card goes to Archive if `calm` or its Cost is 2; otherwise to Threat. Then compact the Rail toward the Airlock (keep order), and refill from the Yard into the Intake end to 5 cards. If the Yard is empty while a slot needs filling → lost (`yard`).
5. **Cleanup.** Circuit cards go to discard, plotted ones to the Course. Hand goes to discard. Draw 5 (6 with Quarters staffed and online). Jump check (below). Reset `pool` and `turnFlags`, then run Systems Online for the next turn.

## Playing a card

Let `prev` = the last Circuit entry (either side), or none.

- **Synced** if `prev.card.suit === card.suit`, or `captainNext` is set.
- **Cascaded** if `card.rank === prev.card.rank + 1`, or `captainNext` is set. A Cascade gives +1 Power (+2 with the Reactor staffed and online). Captain's flag gives each bonus once and is then cleared.
- **Resource side:** pool[suit] += yield + (synced ? 1 : 0) + overdrive.
- **Action side:** run the base or Sync effect. Effects needing a choice push a `Decision`.

`previewPlay` performs only the placement steps above (Circuit entry, flags, resource gains, Cascade Power) and skips action effects. `playCard` performs placement, then effects.

## Spending and payment

- **Salvage** cost = max(0, Cost − slot discount); slot discount is 2 for the Airlock, 1 for the Inner Lock. Pay with the card's suit, then Power. The card goes to discard. Its slot stays empty until Drift.
- **Neutralize** cost = max(0, Cost − patchDiscount) + (Log 2B ? 1 : 0). Pay with the hazard's suit, then Shields.
- **Station** cost = Cost, paid in Crew only.
- **Plot** cost = 2 Data only.
- Auto-pay spends the exact suit first, then the wild.

## Drawing

Draw from the top of the deck. If the deck is empty, shuffle the discard into a new deck; the first reshuffle sets `calm = false`. If both are empty, stop drawing.

## Modules and hazards

- A Module is **offline** while any Threat card shares its suit: no production, no perk, no stationing.
- Perks while staffed and online: Reactor (power) Cascades give 2 Power; Quarters (crew) draw 6 at cleanup; Nav Core (data) Plot from hand; Shield Array (shields) Breach limit +1.

## Jumps and Logs

- At cleanup, Jump if the Course has all four suits and total rank ≥ `[11, 20, 30][jumps] + jumpBonus`.
- On a Jump: Course and Threat go to Archive, `jumps += 1`, then:
  - Jump 1 → pending Log 1 choice. **A:** a chosen Module gets capacity 2. **B:** all Breach cards go to the bottom of the Yard.
  - Jump 2 → pending Log 2 choice. **A:** take 2 chosen Rail cards into hand; Drift also vents the Inner Lock from now on. **B:** Archive up to 3 cards from hand or discard; neutralizing costs +1 from now on.
  - Jump 3 → won.
- **Score on a win:** Yard size + 3 × staffed Modules − 2 × Breach size.

## Setup

- Starting deck: all four 1s, all four 2s, plus two 3s (default: power and shields; any two suits allowed).
- Yard: the other 38 cards, shuffled. Rail: 5 cards from the Yard. Draw 5. `calm = true`.
- Difficulty: **Cadet** starts with all four 3s and Breach limit 6. **Standard** Breach limit 5. **Veteran** Breach limit 4 and jumpBonus 5.

## Rulings (decisions not spelled out in the rulebook)

1. **Relay** gains the previous card's printed yield only if that card was played resource side up; otherwise it gains nothing. Overdrive does not boost Relay.
2. **Overdrive** boosts only cards played resource side up after it. It stacks (+1 per Overdrive played). It does not boost Scrounge, Relay, Jettison or Module production.
3. **Tractor Beam's** −2 stacks with the Inner Lock / Airlock discounts, minimum 0. It is optional.
4. **Engineer** cannot copy another Engineer. A copied action resolves as if Engineer were that card; for a copied Relay, "previous card" means the card before Engineer.
5. **Captain's** "counts as Synced and Cascaded" gives each bonus once, even if the next card would also qualify naturally.
6. **Calm start** ends the moment the first reshuffle happens.
7. **Scrounge's** Sync gain is 2 of one chosen resource.
8. **Scan** looks at fewer cards if the deck has fewer than 3; it never reshuffles.
9. **Jettison** and **Navigator** may choose zero cards.
10. Stationing a card is not a play: it is not added to the Circuit and does not affect Sync or Cascade.
