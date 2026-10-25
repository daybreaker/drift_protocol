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

## Data model

Records mirror the tables a Rails API would have, so they can move to a server unchanged: snake_case fields, client-generated UUID `id`s, ISO 8601 timestamps, and foreign keys named for their table.

| Table | Fields |
| --- | --- |
| `legacy_games` | `id`, `name`, `difficulty`, `starting_threes` (two suits, or null for Cadet), `credits`, `current_chapter_id`, `created_at`, `updated_at` |
| `chapters` | `id`, `legacy_game_id`, `story_key`, `position` (1 = first Story), `status` (`active` \| `completed`), `started_at`, `completed_at` |
| `sessions` | `id`, `legacy_game_id`, `chapter_id`, `attempt` (1 = first try at the chapter), `options` (the engine `GameOptions`), `status` (`in_progress` \| `won` \| `lost`), `score`, `credits_earned`, `state` (the current `GameState`), `action_count`, `undo_states`, `undo_action_ids`, `summary`, `hand_order`, `started_at`, `ended_at`, `updated_at` |
| `actions` | `id`, `legacy_game_id`, `chapter_id`, `session_id`, `seq` (1, 2, 3… within the session), `turn`, `action` (the engine `Action`), `created_at`, `undone_at` |

- A chapter record exists only once its Story is unlocked. Stories themselves are content in code (`src/legacy/stories.ts`), keyed by `story_key`.
- Every action sent during a Session is logged, including ones later undone. `undone_at` marks an undo; nothing is deleted.
- `sessions.state` is the authoritative current state. The action log is history: replaying it from `options` reproduces `state` under the rules it was played with.

## Core contract

```ts
createLegacyGame(input, ctx) → Changes                     // the legacy game and its first chapter
startSession(campaign, ctx) → Changes                      // a new Session for the current chapter
recordAction(campaign, session, action, ctx) → Changes     // applies the action, logs it, and finishes the Session if it ended
undoAction(session, lastAction, ctx) → Changes             // undoes lastAction, the newest action of this turn
setHandOrder(session, handOrder, ctx) → Changes            // saves the player's hand order
mergeChanges(campaign, changes) → Campaign                 // the campaign with changes applied
```

- **Pure.** These take records and return the records to write (`Changes`); they never mutate their input or touch storage. `ctx` supplies the clock and new ids, so tests are deterministic.
- **Storage.** A `LegacyStore` reads records and writes a `Changes` set in one transaction. The app uses IndexedDB (database `drift-protocol-legacy`); tests use an in-memory store held to the same contract. A server-backed store can replace them later.
- **Separate save.** Standard games keep their localStorage save; legacy data never touches it.

## Sessions

- A Session plays with the campaign's difficulty and starting 3s and a new random seed.
- **Won:** the score becomes Credits, the chapter is completed, and the next Story's chapter (if one exists) is created and becomes current.
- **Lost:** no Credits; the chapter stays current and the next Session is attempt + 1.
- Leaving a Session keeps it in progress; it can be continued later.

## Stories

| Position | `story_key` | Title | Content |
| --- | --- | --- | --- |
| 1 | `salvage-rights` | Salvage Rights | The base game, Asteroids included. |

## Changes to the base engine *(Draft)*

Kept as small as possible. A base game uses none of them and behaves exactly as `docs/engine-spec.md` says.

- Cards get an optional `mods` (stickers) and an optional action id, so two cards can share a suit and rank with different actions. Card ids for those get a variant suffix.
- Card count is no longer fixed at 50 (48 numbered cards and 2 Asteroids) in a campaign game. The 50-card invariant stays a base-game check.

## Rulings (decisions not spelled out in the design)

1. Difficulty and starting 3s are chosen once, when the campaign is created, and apply to every Session.
2. Undo works as in the base game, within the current turn. An undone action stays in the log with `undone_at` set.
