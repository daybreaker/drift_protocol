# Drift Protocol

A solo sci-fi deck-builder where every card is either a resource or an action, and chains reward playing them in the right order. This repo is the playable web version.

## Status

The rules engine is being built test-first. The suite in `src/engine/__tests__` describes the whole game and currently fails on purpose (red). Implement `src/engine/engine.ts` until it is green, then build the board UI on top.

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
| `src/engine/` | Pure TypeScript rules engine: `newGame`, `legalActions`, `apply`, `previewPlay`. No UI imports. |
| `src/engine/__tests__/` | Vitest specs, one file per area (setup, chaining, actions, spending, end of turn, jumps). |
| `public/cards/` | Card art: 48 numbered cards and 4 Modules, 1000×1400 JPG. |
| `tools/make_cards.py` | Regenerates the card JPGs (Playwright + Pillow). |

## Rules

The full rulebook lives in Notion under Projects › DRIFT PROTOCOL. Where it is silent, `docs/engine-spec.md` § Rulings decides.
