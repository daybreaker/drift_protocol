# Drift Protocol

A solo sci-fi deck-builder where every card is either a resource or an action, and chains reward playing them in the right order. This repo is the playable web version.

## Status

The rules engine in `src/engine/` is complete and the suite in `src/engine/__tests__` is green, including bot playthroughs that check every listed action applies, `apply` never mutates its input, and all 48 cards stay accounted for. The board UI is playable: `npm run dev`, choose a difficulty and starting 3s, and play. A game in progress is saved in the browser, and Undo steps back within the current turn.

## Commands

```sh
npm install
npm test            # run the engine tests once
npm run test:watch  # TDD loop
npm run typecheck
npm run dev         # Vite dev server
```

## Layout

| Path | What it is |
| --- | --- |
| `docs/engine-spec.md` | State shape, actions, turn sequence and rulings. The source of truth for the engine. |
| `src/engine/` | Pure TypeScript rules engine: `newGame`, `legalActions`, `apply`, `previewPlay` in `engine.ts`; shared queries in `rules.ts`, card actions and decisions in `effects.ts`, end of turn in `turn.ts`. No UI imports. |
| `src/engine/__tests__/` | Vitest specs, one file per area (setup, chaining, actions, spending, end of turn, jumps), plus bot playthroughs. |
| `docs/legacy/legacy-spec.md` | Rules for the Legacy campaign (in progress). |
| `src/legacy/` | Legacy campaign code and its tests in `src/legacy/__tests__/` (in progress). |
| `src/ui/` | React board: `Game.tsx` (layout and UI state), `Board.tsx`, `Hand.tsx` (drag to rearrange), `Tray.tsx`, `Inspector.tsx`, `DecisionPanel.tsx` (card and Log choices), `StartScreen.tsx`, `useGame.ts` (session, undo, saving), plus tested helpers (`summary`, `locate`, `payment`, `handLayout`). |
| `public/cards/` | Card art: 48 numbered cards and 4 Modules, 1000×1400 JPG. |
| `tools/make_cards.py` | Regenerates the card JPGs (Playwright + Pillow). |

## Rules

The design lives in Notion: [DRIFT PROTOCOL](https://app.notion.com/p/3ff7f436dffd813aba57def170b1571e), with the Rules, Playtest Rules (Standard Deck) and Card Design pages under it. Where the rulebook is silent, `docs/engine-spec.md` § Rulings decides.
