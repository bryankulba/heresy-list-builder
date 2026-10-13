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
- `data/parsed/detachments.json` — `{ charts }`: every supported force org chart (Crusade, Allied Detachment, Knight Households…) with its detachments. `loader.ts` derives `detachmentsData.core/apex/auxiliary` from the Crusade chart. Each `DetachmentDef` has `sources?: string[]`; each slot may carry `maxModifiers`
- `data/parsed/rules.json` — Prime benefit trees (`primeGroups`) with their BSData visibility conditions, and the High Command detachment-choice upgrade ids
- Empty `sources[]` = available to all factions; non-empty = faction-restricted
- Faction restrictions come from the detachment's `set hidden=false` modifiers conditioned on `instanceOf primary-catalogue <catalogueId>`

### Rules Evaluator (`src/rules/`)

BSData conditions/modifiers are kept (slimmed) in the parsed data and evaluated at runtime — no hardcoded rule tables:
- `evaluate.ts` — conditions (`instanceOf`, `atLeast`, `equalTo`… over scopes unit/force/roster/primary-catalogue/ancestor), `effectiveHidden`, `applyNumericModifiers` (incl. `repeats`). Anything the roster doesn't contain counts as 0 — accurate here since the app can't create those selections.
- `context.ts` — builds a `RuleContext` for a unit in a slot (`unitContext`) or a detachment's own slots (`detachmentContext`) from roster counts (unit `facts` + chosen Prime benefit ids).
- `primeBenefits.ts` — a unit's Prime benefits in its slot (from its catalogue's benefit tree); Logistical Benefit roles; lookups for export.
- `detachmentLimits.ts` — how many Auxiliary/Apex detachments an army may take: each detachment "costs" 1 of a BSData cost type and the chart caps it, raised per selection (+1 per Command unit, +1 per Officer of the Line (2), +1 per High Command "One Apex/Auxiliary Detachment" choice…). Shown on the points card (over = red warning) and used for unlock prompts. An alternate link swaps the unit's link categories (`unitVariant` facts)
- `validate.ts` — roster warnings (never blocking): points over the limit, detachment allowances and per-detachment roster caps (Knight Additional detachments, faction detachments unlocked by a unit), the Lord of War / Allied points share, empty compulsory slots, units outside their detachment's slots, Prime units without a benefit, unique units (`rosterMax`) taken twice, and allegiance-locked units (`availability.ts`: hidden under this allegiance but not the other, so units hidden for reasons the builder doesn't model are left alone; the unit picker leaves them out too). Shown as card badges, red slot outlines and a list on the points card
- `slots.ts` — `unitsForSlot` (effective primary category in that detachment via `primaryCategoryRules`, plus `alternateLinks` variants like "Command - Centurions Only") and `effectiveSlots`/`withEffectiveSlots` (slot maxes from `maxModifiers`, e.g. a legion rule making all Troops Prime). The canvas renders the effective view; `slotLayout.ts` `cardSlots` treats "Troops-N"/"Prime Troops-N" as the same position so units follow when prime-ness changes.

Counts (`context.ts` `rosterCounts`) include the roster's allegiance choice id and points spent per id/category (`rosterCosts`), with the points limit — BSData's `limit::<points>` fields (the Lord of War Detachment may hold a quarter of the points limit, less Warlord points).

Known gap: Logistical Benefit still uses the app's own `bonusSlots`; its BSData slot increments aren't evaluated (the chosen "LB - Role" isn't counted) to avoid double slots.

### .ros Export & Import (`src/utils/buildRos.ts`, `importRos.ts`)

The export writes rosters the way New Recruit does (verified against `reference_armies/*.ros`, which are New Recruit exports):
- Selection `entryId`s are "::"-joined paths: root link, then each entry link whose *target* was entered, then the final entry (`linkId::targetId` for links). Children attached to a link itself don't add its id (e.g. a Prime Unit's benefit group). `entryGroupId` = prefix + containing group. The parser computes these (`path`/`groupPath` on units, models, wargear, Prime trees, army config).
- Units carry their base cost; models carry theirs. Cost name `Point(s)`.
- Each root force carries required army configuration (`rules.json` `armyConfig`): Allegiance (from the roster), Cohort Doctrine (from the start screen), others with BSData defaults.
- Prime units emit `Prime Unit` with the chosen benefit (and `LB - Role`) nested inside. `FilledSlot.isPrime` makes prime-ness explicit (unset = prime iff in a Prime position). The unit keeps its own role as primary category; the Prime category sits (non-primary) on `Prime Unit`.
- Default wargear (parser `mandatoryIn`): entries with min ≥ 1 (after modifiers settled at parse time — `primary-catalogue` conditions, e.g. Cybernetica only in Mechanicum armies), and for each required group its default, else its first visible free option (e.g. a Skitarii sub-faction) so the export is legal. Children attached to a root link (not its target) are included, with paths that drop the link id.
- Army-wide choices (`rules/armyChoices.ts`): BSData asks Skitarii/Mechanicum units for a sub-faction one unit at a time; the builder picks once per army (start screen, changeable in the header) and the export writes that pick on every unit carrying the group. Groups come from `rules.json` `armyChoices` (shared groups named "…Sub-faction(s)"); the roster stores `armyChoices: groupId → optionId`, and import reads the most common pick back.
- High Command units with a detachment choice emit "One Apex / One Auxiliary Detachment".

`importRos` reads a .ros back into forces (detachments, units in slots, Prime benefits, LB bonus slots, allegiance, doctrine; unlock links are inferred). `referenceRosters.test.ts` round-trips every file in `reference_armies/` (import → export → compare) — add New Recruit exports there to extend coverage. Unsupported root forces are skipped with a warning.

### Faction Registry & Unit Loading

`src/data/factions.ts` is the faction registry: every army the builder can field (18 Legions, Mechanicum, Skitarii, Solar Auxilia, Legio Custodes, Anathema Psykana, Questoris Familia). Each `FactionDef` names its `unitSources` (units.json keys merged at runtime — legions get `legiones-astartes` + their own), its force org `chart`, the auto-added `primaryDetachment`, and `canTakeAllies`. `getUnitsForFaction(faction)` in `loader.ts` merges the unit sources; `getAllyFactions` reads who may ally from the Allied Detachment's `sources`.

Slot matching follows BattleScribe: a slot takes units whose effective primary category equals it (prime slots take their base role, or a qualified variant that has its own slot in the detachment). See `rules/slots.ts`.

### State: Zustand Store (`src/store/rosterStore.ts` + `rosterModel.ts`)

The roster mirrors a .ros file: `forces: Force[]` — the primary army first, then any allied armies. Each `Force` has a `faction`, `kind` (`primary` | `allied`), the `chart` it's built on, and its `detachments: PlacedDetachment[]`. `kind` `lordOfWar` is a Lord of War Detachment — its own root force (the game system's chart, or the army's catalogue chart for Knights), whose single detachment holds the units directly in the .ros. Store state: `phase`, `allegiance`, `pointsLimit`, `cohortDoctrine`, `forces`; `selectPrimaryFaction` derives the army's faction.

All force logic lives as pure functions in `rosterModel.ts` (tested in `rosterModel.test.ts`); the store is a thin wrapper. Detachment ids are globally unique, so slot actions stay keyed by detachment id.

Key store actions: `startBuild` (creates the primary force with its chart's primary detachment), `addDetachment(def, { unlockedBy?, forceId? })` (an unlocked detachment joins the force of the slot that unlocked it), `addAlliedForce`, `removeForce`, `fillSlot`, `clearSlot`, `addBonusSlot`, `fillBonusSlot`, `removeDetachment` (cascades — removes all detachments whose `unlockedBy` starts with the removed detachment's id).

Persistence: session state is persisted with `version: 2` (v1 `{ faction, detachments }` is migrated). Saved lists use `ROSTER_SCHEMA_VERSION` 2; `migrateSnapshot` upgrades older saves. On every load `refreshUnits` replaces stored unit snapshots with current data (by entryId, then name + role), so saved lists pick up points fixes from new BSData syncs.

### Modal State Machine (`src/components/canvas/Canvas.tsx`)

All modals are coordinated by a `ModalState` discriminated union (defined in `src/types/index.ts`). Canvas.tsx is the sole owner — it reads modal state, renders the correct modal, and handles transitions between modal types.

Slot interaction chains:
1. **Prime slot**: `unitPicker` → user picks unit → `primeBenefit` → user picks benefit → if logistical: `bonusSlotRoleSelector` → then the unlocks below
2. **Unlocks** (`startUnlocks`): a High Command unit opens one `detachmentSelector` (Apex or Auxiliary); any other unit opens as many Auxiliary selectors as it adds to the army's BSData allowance (`rules/detachmentLimits.ts` `auxiliaryUnlocks`: 2 for a Centurion as Command — Command + Officer of the Line (2) — but 1 in a "Command - Centurions Only" slot)
4. **Edit existing slot**: opens `slotEdit` first; all subsequent handlers check `isEditingSlot.current` ref and return to `slotEdit` instead of chaining unlocks
5. **Allies**: header "Add Allies" → `allySelector` → `addAlliedForce`; the allied army's Command slots unlock Auxiliary detachments from the ally's own faction (pickers/selectors resolve faction via `factionOfDetachment`)

The unit picker gets its units from `rules/slots.ts` `unitsForSlot`, so qualified slots like `"Troops - Infantry Troop or Levy Troop only"` or `"Heavy Assault - Tartaros Only"` offer exactly the units BSData files there.

Modal state carries data through the chain (e.g., `role: string` and `unit: UnitEntry` on `primeBenefit` and `bonusSlotRoleSelector` states) to avoid re-deriving it at each step.

### Slot Keys and expandSlots

Each `SlotDef` has `max: N` and expands to N individual slot instances with keys `"${role}-${index}"`. These keys are stored in `PlacedDetachment.slots` and referenced by `unlockedBy`.

`expandSlots(def)` in `slotLayout.ts`:
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
| `src/components/canvas/DetachmentCard.tsx` | Card rendering |
| `src/data/loader.ts` | Runtime data filtering helpers |
| `src/data/factions.ts` | Faction registry (`FactionDef`: unit sources, chart, primary detachment, allies) |
| `src/store/rosterModel.ts` | Pure roster/force logic, migrations, unit refresh |
| `src/rules/*` | BSData condition evaluator, Prime benefits, slot matching and slot counts |
| `src/components/canvas/slotLayout.ts` | `expandSlots`, `cardSlots`, `groupByRole`, `estimateCardHeight` |
| `scripts/parse-bsdata.ts` | BSData JSON → app JSON (tests in `parse-bsdata.test.ts`) |
| `scripts/sync-data.ts` | Fetches BSData, runs the parser, writes `data/parsed/` |

## Important Constraints

- `"type": "module"` must NOT be in `package.json` — ts-node (sync-data) needs CJS
- Carbon SCSS uses legacy `@import` — `silenceDeprecations: ['import']` is set in `vite.config.ts`
- Warlord Detachment is in `detachments.json` as a core detachment but is NOT auto-added on `startBuild` — it's only added when the user explicitly clicks "Add Warlord" (Crusade-chart armies only)
- Knight Households' "Additional" detachments are added freely via "Add Detachment"; going past their BSData limits shows a warning
