# Drift Protocol — Engine Spec

The rules engine is pure TypeScript with no UI. Every rule lives here; the React app only renders state and sends actions.

Source of truth for the rules: the Drift Protocol rulebook in Notion ([DRIFT PROTOCOL](https://app.notion.com/p/3ff7f436dffd813aba57def170b1571e) › Rules). Where the rulebook is silent, the **Rulings** section below decides.

## Core contract

```ts
newGame(options) → GameState
legalActions(state) → Action[]
apply(state, action) → GameState        // pure: never mutates its input
previewPlay(state, cardId, side) → GameState   // placement plus effects that need no choice
```

- **Pure and immutable.** `apply` returns a new state. The UI's tentative placement is just `previewPlay(state, …)` rendered; OK sends `playCard`, Cancel discards the preview.
- **Seeded RNG.** All shuffles use the RNG state stored in `GameState`, so a seed plus an action log replays a game exactly.
- **Illegal actions throw.** `apply` throws `IllegalActionError` for any action not in `legalActions(state)`.

## Cards

48 numbered cards (ranks 1–12 in four suits) and 2 **Asteroids**, 50 cards in all. Modules are not cards in the engine; they are fixed slots.

An **Asteroid** (`asteroid-1`, `asteroid-2`; Jokers in the playtest deck) has no suit, rank, yield or action. It starts in the Yard and only ever moves between the Yard, Rail, Threat, Breach and Archive:

- It cannot be salvaged, by Salvage, Tractor Beam or Log 2A.
- When it drifts out of the Airlock it always becomes a hazard, even during calm start.
- Neutralizing it costs 5, paid in Shields only, and it always goes to Archive (it can never be kept).
- It takes no Module offline. If it hits, it goes to Breach like any hazard.

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
| 4 | Jettison | Archive up to 2 cards from hand or discard; gain 2 of each archived card's resource | Up to 3 cards |
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
interface Asteroid { id: string; kind: 'asteroid' }        // id "asteroid-1" or "asteroid-2"
type FieldCard = Card | Asteroid                            // what the Yard, Rail, Threat, Breach and Archive hold

interface CircuitEntry { card: Card; side: Side; synced: boolean; cascaded: boolean; plotted: boolean }

type ChallengeKey = 'full-crew' | 'twin-stations' | … | 'salvage-spree'   // the 24 below
interface ChallengeSlot { key: ChallengeKey; progress: number; done: boolean }   // progress: Tally count; done: Tally or Feat complete

interface GameState {
  rng: number                       // RNG state
  turn: number
  deck: Card[]                      // index 0 = top
  hand: Card[]
  discard: Card[]
  circuit: CircuitEntry[]
  rail: (FieldCard | null)[]        // length 5; index 0 = Airlock, 1 = Inner Lock, 2–3 = Rail, 4 = Intake
  yard: FieldCard[]                 // index 0 = top
  threat: FieldCard[]
  breach: FieldCard[]               // last element = top
  course: Card[]
  archive: FieldCard[]
  modules: Record<Suit, { stationed: Card[]; capacity: number }>
  pool: Record<Suit, number>        // resources this turn
  turnFlags: { overdrive: number; captainNext: boolean; patchDiscount: number; salvagedAirlock: boolean; playedOrSpent: boolean; production: Record<Suit, number>;
               salvages: number; neutralizes: number }   // this turn's counts, for the Salvage Spree and Clean Sweep Feats
  calm: boolean                     // true until the first reshuffle
  jumps: number                     // 0–3
  logs: { log1?: 'A' | 'B'; log2?: 'A' | 'B' }
  pending: Decision[]               // choices waiting on the player; actions other than `resolve` are illegal while non-empty
  challenges: ChallengeSlot[][]     // one list per Jump (1 card, 2 on Veteran); challenges[jumps] is active
  challengeDeck: ChallengeKey[]     // undealt challenges, index 0 = top
  options: { breachLimit: number }
  outcome: null | { result: 'won' } | { result: 'lost'; reason: 'breach' | 'yard' }
}
```

## Actions

| Action | Legal when |
| --- | --- |
| `{ type: 'playCard', cardId, side }` | card in hand; no pending decisions |
| `{ type: 'scrap', cardId }` | card in hand; no pending decisions |
| `{ type: 'salvage', railIndex }` | rail slot holds a numbered card; pool can pay |
| `{ type: 'neutralize', threatIndex, keep: 'discard' \| 'archive' }` | pool can pay; `keep: 'discard'` is never legal for an Asteroid |
| `{ type: 'station', cardId, module }` | card in hand; Module online and below capacity; enough Crew |
| `{ type: 'plot', circuitIndex }` / `{ type: 'plotFromHand', cardId }` | the card's Cost in Data; not already plotted; from hand only with Nav Core staffed and online |
| `{ type: 'recall', module, cardId }` | before the first play or spend this turn |
| `{ type: 'resolve', decisionId, choice }` | answers the first pending decision |
| `{ type: 'endTurn' }` | no pending decisions |

## Turn sequence

1. **Systems Online** (start of turn, automatic). Each online Module produces, for each stationed card, its yield, +1 if its suit matches the Module. Production is recorded in `turnFlags.production` so `recall` can refund it.
2. **Operate.** The player sends actions until `endTurn`.
3. **Impact.** All Threat cards move to Breach. If Breach ≥ limit → lost (`breach`).
4. **Drift.** Unless the Airlock card was salvaged this turn, vent `rail[0]`. With Log 2A, also vent `rail[1]`. A vented Asteroid goes to Threat. Any other vented card goes to Archive if `calm` or its Cost is 2; otherwise to Threat. Then compact the Rail toward the Airlock (keep order), and refill from the Yard into the Intake end to 5 cards. If the Yard is empty while a slot needs filling → lost (`yard`).
5. **Cleanup.** Circuit cards go to discard, plotted ones to the Course. Hand goes to discard. Draw 5 (6 with Quarters staffed and online). Jump check (below). Reset `pool` and `turnFlags`, then run Systems Online for the next turn.

## Playing a card

Let `prev` = the last Circuit entry (either side), or none.

- **Synced** if `prev.card.suit === card.suit`, or `captainNext` is set.
- **Cascaded** if `card.rank === prev.card.rank + 1`, or `captainNext` is set. A Cascade gives +1 Power (+2 with the Reactor staffed and online). Captain's flag gives each bonus once and is then cleared.
- **Resource side:** pool[suit] += yield + (synced ? 1 : 0) + overdrive.
- **Action side:** run the base or Sync effect. Effects needing a choice push a `Decision`.

`previewPlay` performs the placement steps above (Circuit entry, flags, resource gains, Cascade Power), then the parts of the action that need no choice and reveal no hidden card: Relay's gain, Patch's discount (and its Sync Breach move), and the Overdrive and Captain flags. It never draws, shuffles or pushes a decision. `playCard` performs placement, then the full effects.

## Scrap

`scrap` Archives a card from hand and gains 2 of its suit's resource. It is not a play: the card never enters the Circuit, nothing Syncs or Cascades, and the previous Circuit card stays "previous" for chaining. Overdrive does not boost it. It sets `playedOrSpent`, so it ends the recall window.

## Spending and payment

- **Salvage** cost = max(0, Cost − slot discount); slot discount is 2 for the Airlock, 1 for the Inner Lock. Pay with the card's suit, then Power. The card goes to discard. Its slot stays empty until Drift.
- **Neutralize** cost = max(0, Cost − patchDiscount) + (Log 2B ? 1 : 0) to archive the hazard, +2 more to take it into your discard pile instead. Pay with the hazard's suit, then Shields. An Asteroid's Cost is 5, it is paid in Shields only, and it can only be archived.
- **Station** cost = Cost, paid in Crew only.
- **Plot** cost = the card's Cost, in Data only.
- Auto-pay spends the exact suit first, then the wild.

## Drawing

Draw from the top of the deck. If the deck is empty, shuffle the discard into a new deck; the first reshuffle sets `calm = false`. If both are empty, stop drawing.

## Modules and hazards

- A Module is **offline** while any Threat card shares its suit: no production, no perk, no stationing.
- Perks while staffed and online: Reactor (power) Cascades give 2 Power; Quarters (crew) draw 6 at cleanup; Nav Core (data) Plot from hand; Shield Array (shields) Breach limit +1.

## Jumps and Logs

- At cleanup, Jump if the Course has all four suits, total rank ≥ `[14, 24, 34][jumps]`, and every active challenge is complete (below).
- On a Jump: Course and Threat go to Archive, `jumps += 1`, then:
  - Jump 1 → pending Log 1 choice. **A:** a chosen Module gets capacity 2. **B:** all Breach cards go to the bottom of the Yard.
  - Jump 2 → pending Log 2 choice. **A:** take 2 chosen Rail cards into hand; Drift also vents the Inner Lock from now on. **B:** Archive up to 3 cards from hand or discard; neutralizing costs +1 from now on.
  - Jump 3 → won.
- **Score on a win:** Yard size + 3 × staffed Modules − 2 × Breach size.

## Jump challenges

Each Jump also needs its challenge. At setup the 24-card challenge deck is shuffled and 3 are dealt in order, one for each Jump (Veteran: 2 per Jump, 6 in all, and both are required). Only the **active** challenges, `challenges[jumps]`, track progress; a later Jump's challenge starts counting when it becomes active.

- **State:** true of the board when the Jump check runs at cleanup.
- **Tally:** counts events while active, across turns, until it reaches its target. Once complete it stays complete.
- **Feat:** done within a single turn. Checked after every action (and after Systems Online). Once done it stays done.

| # | Challenge | Type | Complete when |
| --- | --- | --- | --- |
| 1 | Full Crew | State | All 4 Modules staffed |
| 2 | Twin Stations | State | 2 Modules each have a stationed card of their own suit |
| 3 | Clean Hull | State | Breach holds 1 card or fewer |
| 4 | Quiet Sky | State | No hazard hit at Impact this turn |
| 5 | Lean Ship | State | Deck + hand + discard hold 15 cards or fewer |
| 6 | Deep Course | State | Course total rank ≥ this Jump's threshold + 5 |
| 7 | Balanced Course | State | The Course holds at least 2 cards of every suit |
| 8 | Officer Corps | State | The Course holds 3 cards of rank 9+ |
| 9 | Space Junk | Tally 4 | Neutralize and Archive hazards |
| 10 | Scrap Run | Tally 6 | Archive your own cards (Scrap, Jettison, Log 2B) |
| 11 | Hazard Bounty | Tally 3 | Neutralize Cost 5 hazards (Asteroids count; archived or kept) |
| 12 | Airlock Rescue | Tally 3 | Salvage from the Airlock (Tractor Beam counts) |
| 13 | Recruitment Drive | Tally 3 | Station cards (Dock counts) |
| 14 | Signal Boost | Tally 3 | Plot by paying Data (Plot or Plot from hand; not Navigator) |
| 15 | Hull Repair | Tally 2 | Move Breach cards to the Yard (Patch's Sync, Log 1B: each card counts) |
| 16 | Heavy Salvage | Tally 3 | Salvage Cost 5 cards (Tractor Beam counts) |
| 17 | Long Circuit | Feat | 6+ cards in the Circuit |
| 18 | Cascade Run | Feat | 3 Cascaded cards in the Circuit |
| 19 | Full Sync | Feat | 4 cards of one suit in a row in the Circuit |
| 20 | Overclock | Feat | 10+ resources in the pool at once |
| 21 | Spectrum | Feat | A card of each suit played resource side up |
| 22 | Bridge Crew | Feat | A 10, an 11 and a 12 in the Circuit (either side) |
| 23 | Clean Sweep | Feat | Neutralize 2 hazards in one turn |
| 24 | Salvage Spree | Feat | Salvage 3 cards in one turn (Tractor Beam counts) |

## Setup

- Starting deck: all four 1s, all four 2s, plus two 3s (default: power and shields; any two suits allowed).
- Yard: the other 38 numbered cards and both Asteroids, shuffled together (40 cards). Rail: 5 cards from the Yard. Draw 5. `calm = true`.
- Challenges: shuffle the 24 challenges (after the Yard, so a seed deals the same cards as before challenges existed) and deal 3 in order, one per Jump (Veteran: 2 per Jump).
- Difficulty: **Cadet** starts with all four 3s and Breach limit 6, and starts with a pending `redeal` decision: replace one dealt challenge with the top of the challenge deck, or keep them all. **Standard** Breach limit 5. **Veteran** Breach limit 4, and 2 challenges per Jump.

## Rulings (decisions not spelled out in the rulebook)

1. **Relay** gains the previous card's printed yield only if that card was played resource side up; otherwise it gains nothing. Overdrive does not boost Relay.
2. **Overdrive** boosts only cards played resource side up after it. It stacks (+1 per Overdrive played). It does not boost Scrounge, Relay, Jettison, Scrap or Module production.
3. **Tractor Beam's** −2 stacks with the Inner Lock / Airlock discounts, minimum 0. It is optional.
4. **Engineer** cannot copy another Engineer. A copied action resolves as if Engineer were that card; for a copied Relay, "previous card" means the card before Engineer.
5. **Captain's** "counts as Synced and Cascaded" gives each bonus once, even if the next card would also qualify naturally.
6. **Calm start** ends the moment the first reshuffle happens.
7. **Scrounge's** Sync gain is 2 of one chosen resource.
8. **Scan** with fewer than 3 cards in the deck shows the cards it has, then shuffles the discard pile in under them and shows the rest from there. Like any reshuffle, this ends calm start. It looks at fewer than 3 only when the deck and discard together hold fewer.
9. **Jettison** and **Navigator** may choose zero cards.
10. Stationing a card is not a play: it is not added to the Circuit and does not affect Sync or Cascade.
11. **Recall** empties that Module's production for the turn: the whole amount it produced at Systems Online is refunded, even if another card stays stationed there (rulebook: "that Module produces nothing this turn").
12. **Patch** stacks: each Patch played or copied this turn takes another 2 off neutralizing.
13. **Engineer** may copy a Circuit card played on either side. With nothing it can copy, it does nothing.
14. **Dock's** Sync makes the Module produce for every card stationed there, not only the new one.
15. **Log 2A** vents the Inner Lock every Drift, even on a turn when the Airlock card was salvaged.
16. **Shield Array's** +1 Breach limit is checked after Impact moves the hazards, so a Shields hazard hitting this turn does not take it offline for that check.
17. **Keeping a hazard** costs 2 more than archiving it: neutralize-and-archive costs the base amount above, neutralize-and-keep costs that +2. Patch's discount and Log 2B's +1 change only the base amount; the +2 always applies. (Changes the rulebook, where a neutralized hazard could be kept for the same price.)
18. **Plotting** costs the card's Cost in Data (2, 3 or 5), for Plot and Plot from hand alike. Navigator still plots for free. (Changes the rulebook's flat 2 Data, so high cards are dearer to commit.)
19. **Jump 1** needs 14 total rank, up from 11. (Jumps 2 and 3 were raised later; see Ruling 21.)
20. **Asteroids** (two, added to the Yard) cannot be salvaged and always become hazards when they drift out of the Airlock, calm start or not. Neutralizing one costs 5 in Shields only and archives it; Patch's discount and Log 2B's +1 apply as for any hazard. One that hits goes to Breach, and a Breach Asteroid moved back to the Yard (Patch's Sync, Log 1B) can drift in again. (New to the rulebook: Jokers in the playtest deck.)
21. **Jumps 2 and 3** need 24 and 34 total rank, up from 20 and 30. (Playtest deck: 29 and 39.) Veteran no longer adds 5 to each threshold; see Ruling 24.
22. **Scrap** (new): Archive a card from hand and gain 2 of its suit's resource. It is not a play (see Scrap above). **Jettison** now Archives up to 2 cards (Sync: 3) and gains 2 of each archived card's resource, replacing +1 Power per card.
23. **Jump challenges** (new): each Jump also needs its challenge complete; see Jump challenges above. The Jump is checked once, at cleanup, as before.
24. **Veteran** deals 2 challenges per Jump, both required, and no longer adds 5 to the Jump thresholds (`jumpBonus` is gone). **Cadet** may redeal one challenge at setup.
25. **What counts toward a challenge.** Scrap Run counts Scrap, Jettison and Log 2B, not the Course archived on a Jump. Tractor Beam counts as salvaging (Airlock Rescue, Heavy Salvage, Salvage Spree); Log 2A does not. Full Sync needs 4 cards that really share a suit; Captain's "counts as Synced" doesn't help. Bridge Crew counts either side. Hull Repair counts each card Log 1B moves. Recruitment Drive counts Dock. Hazard Bounty counts an Asteroid (Cost 5), archived or kept.
