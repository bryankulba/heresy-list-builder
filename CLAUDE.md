# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite bundle (uses tsconfig.app.json)
npm run preview      # Preview built output
npm run sync-data    # Fetch latest BSData XML and regenerate data/parsed/*.json
```

`sync-data` downloads 24 `.cat`/`.gst` files from the BSData GitHub repo into `data/raw/` (gitignored), then parses them into `data/parsed/`. Run this when BSData upstream changes or when editing `scripts/parse-cats.ts`.

## Architecture Overview

### Data Pipeline

BSData XML → `scripts/parse-cats.ts` (regex parser, no DOM) → `data/parsed/*.json` → `src/data/loader.ts` (runtime helpers) → components.

- `data/parsed/units.json` — `Record<factionKey, UnitEntry[]>`
- `data/parsed/detachments.json` — `{ core, auxiliary, apex, legion }` arrays, each `DetachmentDef` has `sources?: string[]`
- Empty `sources[]` = available to all factions; non-empty = faction-restricted
- `FACTION_COMMENT_MAP` in `parse-cats.ts` maps BSData XML comment strings to faction keys — this is the source of faction restrictions on detachments

### Faction/Unit Loading

`src/data/factions.ts` defines `SM_LEGION_KEYS` — the set of Space Marine legion faction keys. All SM legions get Legiones Astartes base units merged with their faction-specific units. `getUnitsForFaction(faction)` in `loader.ts` handles this merge.

Role matching strips qualifiers before filtering: `"Prime Command"` → `"Command"`, `"Command - Centurions Only"` → `"Command"`.

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

`expandSlots(def)` in `DetachmentCard.tsx` (also exported for list view):
- Filters out qualifier slots (role contains ` - `)
- Merges prime slots into regular — prime slots replace one regular slot from the pool, rendered first
- Result: `{ key, slotDef }[]` with consistent key ordering

`groupByRole(expanded)` clusters expanded slots by display role, preserving BSData ordering.

### Views

`Canvas.tsx` owns view state (`'canvas' | 'list'`). The header toggle and `ListView` are both rendered inside `Canvas.tsx`. `ListView` (`src/components/list/`) reuses `expandSlots`, `groupByRole`, and `Slot` from the canvas components — no logic duplication.

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
| `src/constants/primeBenefits.ts` | Prime benefits + `OFFICER_OF_THE_LINE_UNITS` set |
| `scripts/parse-cats.ts` | BSData XML → JSON (contains `FACTION_COMMENT_MAP`) |

## Important Constraints

- `"type": "module"` must NOT be in `package.json` — ts-node (sync-data) needs CJS
- Carbon SCSS uses legacy `@import` — `silenceDeprecations: ['import']` is set in `vite.config.ts`
- Warlord Detachment is in `detachments.json` as a core detachment but is NOT auto-added on `startBuild` — it's only added when the user explicitly clicks "Add Warlord"
