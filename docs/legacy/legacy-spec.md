# Drift Protocol — Legacy Spec

The rules for the Legacy campaign: what persists between games, and how campaign content changes a game. The base game's rules stay in `docs/engine-spec.md`; nothing here changes a game played without a campaign.

Design background: [Legacy Campaign](https://app.notion.com/p/4007f436dffd8117a962f309358af351) in Notion. Where this spec and Notion disagree, this spec governs the code, and new rulings go in its **Rulings** section.

**Status:** draft. Sections marked *Draft* are design intent, not yet built or tested.

## Terms

- **Session:** one game, from setup through Log 3. Winning Log 3 wins the Session.
- **Story:** a chapter. It sets up its Session's content. Winning the Session unlocks the next Story.
- **Drydock:** the step between Sessions, where Credits are spent and the Ledger pays out.
- **Credits:** campaign currency. A won Session's score becomes Credits.
- **Ledger:** invested cards waiting for their payoff.
- **Sticker:** a permanent modification on one card.

## Core contract *(Draft)*

```ts
newCampaign(options) → Campaign
startSession(campaign) → GameState      // builds the deck, Yard and options from the campaign
endSession(campaign, finalState) → Campaign   // applies the result: Credits, stickers, unlocks
```

- **Pure.** Like the engine, these never mutate their input, and any randomness uses the seeded RNG from `src/engine/rng.ts`, with its state stored in the `Campaign`.
- **Separate save.** The campaign is saved under its own key, `drift-protocol:campaign:v1`, apart from the base game's session save, and can be exported and imported.

## Changes to the base engine *(Draft)*

Kept as small as possible. A base game uses none of them and behaves exactly as `docs/engine-spec.md` says.

- Cards get an optional `mods` (stickers) and an optional action id, so two cards can share a suit and rank with different actions. Card ids for those get a variant suffix.
- Card count is no longer fixed at 48 in a campaign game. The 48-card invariant stays a base-game check.

## Rulings (decisions not spelled out in the design)

None yet.
