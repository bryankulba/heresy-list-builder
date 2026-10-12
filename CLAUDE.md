# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite bundle (uses tsconfig.app.json)
npm run preview      # Preview built output
npm run sync-data    # Fetch latest BSData JSON and regenerate data/parsed/*.json
npm run sync-data -- --offline   # Re-parse data/raw/ without fetching
npm test             # Run tests in watch mode
npm test -- --run    # Run tests once (CI mode)
npm test:ui          # Open Vitest UI dashboard
```

`sync-data` downloads every root-level `.json` file from the BSData GitHub repo (BSData switched from `.cat`/`.gst` XML to JSON on 2026-07-14) into `data/raw/` (gitignored), then parses them into `data/parsed/`. Set `BSDATA_REF=<sha|branch>` to pin an upstream version; the commit used is recorded in `system.json`. Run this when BSData upstream changes or when editing `scripts/parse-bsdata.ts` (use `--offline` to iterate on the parser).

## Architecture Overview

### Data Pipeline

BSData JSON → `scripts/parse-bsdata.ts` → `data/parsed/*.json` → `src/data/loader.ts` (runtime helpers) → components.

The BSData JSON is the BattleScribe schema as objects (`forceEntries`, `sharedSelectionEntries`, `entryLinks`, `categoryLinks`, `constraints`, `modifiers`, `modifierGroups`…). Things the parser relies on:
- Entry links can target shared entries/groups in *other* catalogues (e.g. Skitarii links Mechanicum units) — resolved through a cross-catalogue index
- `modifierGroups` carry conditions that apply to every modifier inside them
- Root entry links may be re-filed by unconditional `set-primary` category modifiers

- `data/parsed/units.json` — `Record<factionKey, UnitEntry[]>`; faction keys are slugified catalogue names (`emperors-children`, `skitarii-conclaves`); the extracted factions are listed in `UNIT_FACTIONS` in `scripts/sync-data.ts`
- `data/parsed/detachments.json` — `{ core, auxiliary, apex, legion }` arrays, each `DetachmentDef` has `sources?: string[]`
- Empty `sources[]` = available to all factions; non-empty = faction-restricted
- Faction restrictions come from the detachment's `set hidden=false` modifiers conditioned on `instanceOf primary-catalogue <catalogueId>`

### Faction/Unit Loading

`src/data/factions.ts` defines `SM_LEGION_KEYS` — the set of Space Marine legion faction keys. All SM legions get Legiones Astartes base units merged with their faction-specific units. `getUnitsForFaction(faction)` in `loader.ts` handles this merge.

Role matching strips the `Prime ` prefix and qualifiers from the *slot*: `"Prime Command"` → `"Command"`, `"Command - Centurions Only"` → `"Command"`. A *unit* whose `primaryCategory` is itself qualified (e.g. `"Troops - Infantry Troop or Levy Troop only"`) only fills a slot with exactly that category.

### State: Zustand Store (`src/store/rosterStore.ts`)

Single store with `phase`, `faction`, `allegiance`, `pointsLimit`, `detachments: PlacedDetachment[]`.

Key store actions: `startBuild` (auto-adds Crusade Primary Detachment), `addDetachment`, `fillSlot`, `clearSlot`, `addBonusSlot`, `fillBonusSlot`, `removeDetachment` (cascades — removes all detachments whose `unlockedBy` starts with the removed detachment's id).

### Modal State Machine (`src/components/canvas/Canvas.tsx`)

All modals are coordinated by a `ModalState` discriminated union (defined in `src/types/index.ts`). Canvas.tsx is the sole owner — it reads modal state, renders the correct modal, and handles transitions between modal types.

Slot interaction chains:
1. **Prime slot**: `unitPicker` → user picks unit → `primeBenefit` → user picks benefit → if logistical: `bonusSlotRoleSelector` → `detachmentSelector`; otherwise if HC/Command: `detachmentSelector`
2. **Regular HC/Command slot**: `unitPicker` → `detachmentSelector` (opens the Apex/Aux selector)
3. **Officer of the Line**: triggers `detachmentSelector` twice (double unlock)
4. **Edit existing slot**: opens `slotEdit` first; all subsequent handlers check `isEditingSlot.current` ref and return to `slotEdit` instead of chaining unlocks

Modal state carries data through the chain (e.g., `role: string` and `unit: UnitEntry` on `primeBenefit` and `bonusSlotRoleSelector` states) to avoid re-deriving it at each step.

### Slot Keys and expandSlots

Each `SlotDef` has `max: N` and expands to N individual slot instances with keys `"${role}-${index}"`. These keys are stored in `PlacedDetachment.slots` and referenced by `unlockedBy`.

`expandSlots(def)` in `DetachmentCard.tsx`:
- Filters out qualifier slots (role contains ` - `) when the detachment also has a plain slot of the same base role
- Merges prime slots into regular — prime slots replace one regular slot from the pool, rendered first
- Result: `{ key, slotDef }[]` with consistent key ordering

`groupByRole(expanded)` clusters expanded slots by display role, preserving BSData ordering.

### Layout notes

Carbon Design System header is `position: fixed` (48px tall). Any scrollable content area directly below it needs `paddingTop: 64` (48px header + 16px gap).

### Canvas Layout

The canvas is a large `4000×3000px` div inside an `overflow: hidden` viewport container. Pan is CSS `transform: translate(panX, panY)`. Scroll wheel adjusts Y, mouse drag on background adjusts both axes. Detachment card positions are computed from fixed layout rules (not user-draggable). SVG connector lines are rendered as an absolute-positioned overlay with `pointer-events: none`.

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | All TypeScript types + `ModalState` union |
| `src/store/rosterStore.ts` | All state + mutations |
| `src/components/canvas/Canvas.tsx` | Modal orchestration + canvas layout |
| `src/components/canvas/DetachmentCard.tsx` | `expandSlots`, `groupByRole`, card rendering |
| `src/data/loader.ts` | Runtime data filtering helpers |
| `src/data/factions.ts` | Faction list + `SM_LEGION_KEYS` |
| `src/constants/primeBenefits.ts` | Prime benefits (hardcoded for now — see docs/ROADMAP-1.0.md) |
| `scripts/parse-bsdata.ts` | BSData JSON → app JSON (tests in `parse-bsdata.test.ts`) |
| `scripts/sync-data.ts` | Fetches BSData, runs the parser, writes `data/parsed/` |

## Important Constraints

- `"type": "module"` must NOT be in `package.json` — ts-node (sync-data) needs CJS
- Carbon SCSS uses legacy `@import` — `silenceDeprecations: ['import']` is set in `vite.config.ts`
- Warlord Detachment is in `detachments.json` as a core detachment but is NOT auto-added on `startBuild` — it's only added when the user explicitly clicks "Add Warlord"
