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
- `data/parsed/detachments.json` — `{ core, auxiliary, apex, legion, charts }`; `core/auxiliary/apex` are the Crusade chart's detachments, `charts` lists every supported force org chart (Crusade, Allied Detachment, Knight Households…) with its detachments. Each `DetachmentDef` has `sources?: string[]`
- Empty `sources[]` = available to all factions; non-empty = faction-restricted
- Faction restrictions come from the detachment's `set hidden=false` modifiers conditioned on `instanceOf primary-catalogue <catalogueId>`

### Faction Registry & Unit Loading

`src/data/factions.ts` is the faction registry: every army the builder can field (18 Legions, Mechanicum, Skitarii, Solar Auxilia, Legio Custodes, Anathema Psykana, Questoris Familia). Each `FactionDef` names its `unitSources` (units.json keys merged at runtime — legions get `legiones-astartes` + their own), its force org `chart`, the auto-added `primaryDetachment`, and `canTakeAllies`. `getUnitsForFaction(faction)` in `loader.ts` merges the unit sources; `getAllyFactions` reads who may ally from the Allied Detachment's `sources`.

Role matching strips the `Prime ` prefix and qualifiers from the *slot*: `"Prime Command"` → `"Command"`, `"Command - Centurions Only"` → `"Command"`. A *unit* whose `primaryCategory` is itself qualified (e.g. `"Troops - Infantry Troop or Levy Troop only"`) only fills a slot with exactly that category.

### State: Zustand Store (`src/store/rosterStore.ts` + `rosterModel.ts`)

The roster mirrors a .ros file: `forces: Force[]` — the primary army first, then any allied armies. Each `Force` has a `faction`, `kind` (`primary` | `allied`), the `chart` it's built on, and its `detachments: PlacedDetachment[]`. Store state: `phase`, `allegiance`, `pointsLimit`, `cohortDoctrine`, `forces`; `selectPrimaryFaction` derives the army's faction.

All force logic lives as pure functions in `rosterModel.ts` (tested in `rosterModel.test.ts`); the store is a thin wrapper. Detachment ids are globally unique, so slot actions stay keyed by detachment id.

Key store actions: `startBuild` (creates the primary force with its chart's primary detachment), `addDetachment(def, { unlockedBy?, forceId? })` (an unlocked detachment joins the force of the slot that unlocked it), `addAlliedForce`, `removeForce`, `fillSlot`, `clearSlot`, `addBonusSlot`, `fillBonusSlot`, `removeDetachment` (cascades — removes all detachments whose `unlockedBy` starts with the removed detachment's id).

Persistence: session state is persisted with `version: 2` (v1 `{ faction, detachments }` is migrated). Saved lists use `ROSTER_SCHEMA_VERSION` 2; `migrateSnapshot` upgrades older saves. On every load `refreshUnits` replaces stored unit snapshots with current data (by entryId, then name + role), so saved lists pick up points fixes from new BSData syncs.

### Modal State Machine (`src/components/canvas/Canvas.tsx`)

All modals are coordinated by a `ModalState` discriminated union (defined in `src/types/index.ts`). Canvas.tsx is the sole owner — it reads modal state, renders the correct modal, and handles transitions between modal types.

Slot interaction chains:
1. **Prime slot**: `unitPicker` → user picks unit → `primeBenefit` → user picks benefit → if logistical: `bonusSlotRoleSelector` → `detachmentSelector`; otherwise if HC/Command: `detachmentSelector`
2. **Regular HC/Command slot**: `unitPicker` → `detachmentSelector` (opens the Apex/Aux selector)
3. **Officer of the Line**: triggers `detachmentSelector` twice (double unlock)
4. **Edit existing slot**: opens `slotEdit` first; all subsequent handlers check `isEditingSlot.current` ref and return to `slotEdit` instead of chaining unlocks
5. **Allies**: header "Add Allies" → `allySelector` → `addAlliedForce`; the allied army's Command slots unlock Auxiliary detachments from the ally's own faction (pickers/selectors resolve faction via `factionOfDetachment`)

The unit picker filters by the full slot category (`slotRole`), so qualified slots like `"Troops - Infantry Troop or Levy Troop only"` offer the units filed under exactly that category.

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

The canvas is a large `4000×3000px` div inside an `overflow: hidden` viewport container. Pan is CSS `transform: translate(panX, panY)`; ctrl/pinch zooms. Armies are stacked vertically (allied armies get a label); within an army the root detachment is anchored left (Warlord below), Apex detachments in a 2-column grid to the right, other detachments below. Row heights come from `estimateCardHeight` in `DetachmentCard.tsx`. Cards can be long-press dragged (position overrides are not persisted). SVG connector lines are rendered as an absolute-positioned overlay with `pointer-events: none`.

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | All TypeScript types + `ModalState` union |
| `src/store/rosterStore.ts` | All state + mutations |
| `src/components/canvas/Canvas.tsx` | Modal orchestration + canvas layout |
| `src/components/canvas/DetachmentCard.tsx` | `expandSlots`, `groupByRole`, card rendering |
| `src/data/loader.ts` | Runtime data filtering helpers |
| `src/data/factions.ts` | Faction registry (`FactionDef`: unit sources, chart, primary detachment, allies) |
| `src/store/rosterModel.ts` | Pure roster/force logic, migrations, unit refresh |
| `src/constants/primeBenefits.ts` | Prime benefits (hardcoded for now — see docs/ROADMAP-1.0.md) |
| `scripts/parse-bsdata.ts` | BSData JSON → app JSON (tests in `parse-bsdata.test.ts`) |
| `scripts/sync-data.ts` | Fetches BSData, runs the parser, writes `data/parsed/` |

## Important Constraints

- `"type": "module"` must NOT be in `package.json` — ts-node (sync-data) needs CJS
- Carbon SCSS uses legacy `@import` — `silenceDeprecations: ['import']` is set in `vite.config.ts`
- Warlord Detachment is in `detachments.json` as a core detachment but is NOT auto-added on `startBuild` — it's only added when the user explicitly clicks "Add Warlord" (Crusade-chart armies only)
- Knight Households' "Additional" detachments are added freely via "Add Detachment"; their limits (BSData counting modifiers) await the Phase 3 rules evaluator
