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
npm run samples      # Write ten generated test armies to sample_exports/*.ros (src/tools/sampleArmies.ts)
```

`sync-data` downloads every root-level `.json` file from the BSData GitHub repo (BSData switched from `.cat`/`.gst` XML to JSON on 2026-07-14) into `data/raw/` (gitignored), then parses them into `data/parsed/`. Set `BSDATA_REF=<sha|branch>` to pin an upstream version; the commit used is recorded in `system.json`. Run this when BSData upstream changes or when editing `scripts/parse-bsdata.ts` (use `--offline` to iterate on the parser).

## Architecture Overview

### Data Pipeline

BSData JSON → `scripts/parse-bsdata.ts` → `data/parsed/*.json` → `src/data/loader.ts` (runtime helpers) → components.

The BSData JSON is the BattleScribe schema as objects (`forceEntries`, `sharedSelectionEntries`, `entryLinks`, `categoryLinks`, `constraints`, `modifiers`, `modifierGroups`…). Things the parser relies on:
- Entry links can target shared entries/groups in *other* catalogues (e.g. Skitarii links Mechanicum units) — resolved through a cross-catalogue index
- `modifierGroups` carry conditions that apply to every modifier inside them
- Root entry links may be re-filed by unconditional `set-primary` category modifiers

- `data/parsed/units/<key>.json` — each catalogue's `UnitEntry[]`; keys are slugified catalogue names (`emperors-children`, `skitarii-conclaves`); the extracted catalogues are listed in `UNIT_FACTIONS` in `scripts/sync-data.ts`. The app loads them on demand (`loadFactionUnits` / `loadAllUnits` in `loader.ts`): store actions that start, load or add an army await them, the app waits for a restored session's armies, and import loads all. Reads (`getUnitsForFaction`) are synchronous once loaded; tests load everything in `src/test/setup.ts`
- `data/parsed/detachments.json` — `{ charts }`: every supported force org chart (Crusade, Allied Detachment, Knight Households, Zone Mortalis…) with its detachments and chart-level `errors`. A chart in `CHARTS_WITH_LINKED_DETACHMENTS` also gets the detachments it links from another chart (`linkId`; Zone Mortalis links the Crusade Auxiliary / Apex detachments; exported as `linkId::targetId`). `loader.ts` derives `detachmentsData.core/apex/auxiliary` from the Crusade chart. Each `DetachmentDef` has `sources?: string[]`; each slot may carry `maxModifiers`
- `data/parsed/rules.json` — Prime benefit trees (`primeGroups`) with their BSData visibility conditions, and the High Command detachment-choice upgrade ids
- Empty `sources[]` = available to all factions; non-empty = faction-restricted
- Faction restrictions come from the detachment's `set hidden=false` modifiers conditioned on `instanceOf primary-catalogue <catalogueId>`

### Zone Mortalis

A second game type for Crusade-chart armies: the start screen's game type picks the `Zone Mortalis` chart and one of its primary detachments (`zoneMortalisPrimaries`: Strike Force, Bulwark, Linebreaker, Crusade Primary); `startBuild`'s `game` option creates the primary force on it. Auxiliary / Apex pickers use the force's chart (`getDetachmentsForFaction(type, faction, chart)`). `availability.ts` `chartBan` reads the chart's BSData errors keyed on a single category — Zone Mortalis' "Invalid ZM Vehicle" (flyers, 3+ hull points) — to leave those units out of pickers and slot/detachment availability, and to warn on imported ones. The export writes the required "Zone Mortalis" configuration (special rules, terrain, Advanced Reactions).

### Rules Evaluator (`src/rules/`)

BSData conditions/modifiers are kept (slimmed) in the parsed data and evaluated at runtime — no hardcoded rule tables:
- `evaluate.ts` — conditions (`instanceOf`, `atLeast`, `equalTo`… over scopes unit/force/roster/primary-catalogue/ancestor), `effectiveHidden`, `applyNumericModifiers` (incl. `repeats`). Anything the roster doesn't contain counts as 0 — accurate here since the app can't create those selections.
- `context.ts` — builds a `RuleContext` for a unit in a slot (`unitContext`) or a detachment's own slots (`detachmentContext`) from roster counts (unit `facts` + chosen Prime benefit ids).
- `primeBenefits.ts` — a unit's Prime benefits in its slot (from its catalogue's benefit tree); Logistical Benefit roles; lookups for export.
- `detachmentLimits.ts` — how many Auxiliary/Apex detachments an army may take: each detachment "costs" 1 of a BSData cost type and the chart caps it, raised per selection (+1 per Command unit, +1 per Officer of the Line (2), +1 per High Command "One Apex/Auxiliary Detachment" choice…). Shown on the points card (over = red warning) and used for unlock prompts. An alternate link swaps the unit's link categories (`unitVariant` facts)
- `validate.ts` — roster warnings (never blocking): points over the limit, detachment allowances and per-detachment roster caps (Knight Additional detachments, faction detachments unlocked by a unit), the Lord of War / Allied points share, empty compulsory slots, units outside their detachment's slots, Prime units without a benefit, unique units (`rosterMax`) taken twice, Prime benefits past their BSData limit (`PrimeNode.max`: Seneschal once per roster, Master Sergeant once per detachment — the benefit picker leaves them out once used), BSData's own errors on placed detachments ("Multiple Mechanicum Traits in Detachment"), and allegiance-locked units (`availability.ts`: hidden under this allegiance but not the other, so units hidden for reasons the builder doesn't model are left alone; the unit picker leaves them out too). Shown as card badges, red slot outlines and a list on the points card
- `slots.ts` — `unitsForSlot` (effective primary category in that detachment via `primaryCategoryRules`, plus `alternateLinks` variants like "Command - Centurions Only") and `effectiveSlots`/`withEffectiveSlots` (slot maxes from `maxModifiers`, e.g. a legion rule making all Troops Prime). The canvas renders the effective view; `slotLayout.ts` `cardSlots` treats "Troops-N"/"Prime Troops-N" as the same position so units follow when prime-ness changes.

Counts (`context.ts` `rosterCounts(forces, { allegiance, pointsLimit, cohortDoctrine })`) include the army configuration's choice ids and points spent per id/category (`rosterCosts`), with the points limit — BSData's `limit::<points>` fields (the Lord of War Detachment may hold a quarter of the points limit, less Warlord points).

- `options.ts` — which choices to offer: the detachment picker hides detachments no unit of the army can fill or that only its configuration could unlock, and dims ones a unit would unlock with BSData's error text (or "Unlocked by <units / Prime benefit>"); `fillableSlots` drops slot roles no unit of the army can fill from cards (the canvas view). Logistical Benefit roles are limited to roles the army has units for.
- `armyConfig.ts` — army configuration from BSData: single-choice settings with their own picker (`configOptions`: Rite of War, Household Paradigms, Legiones Auxilia designation, Provenances of War — `configChoices` in the roster, editable on the start screen and in the header), cohort doctrines (choice names, e.g. "Cohort Doctrine: Mechanised Pattern Cohort"; old slugs normalised), and `configCounts` — the ids the chosen allegiance and doctrine put in the roster.

Logistical Benefit: the chosen role is `FilledSlot.lbRole`; counting its "LB - <role>" choice makes BSData add that slot (`maxModifiers`), so it's an ordinary slot on the card. Lists saved with the old app-managed `bonusSlots` are migrated on load (`migrateBonusSlots`).

### .ros Export & Import (`src/utils/buildRos.ts`, `importRos.ts`)

The export writes rosters the way New Recruit does (verified against `reference_armies/*.ros`, which are New Recruit exports):
- Selection `entryId`s are "::"-joined paths: root link, then each entry link whose *target* was entered, then the final entry (`linkId::targetId` for links). Children attached to a link itself don't add its id (e.g. a Prime Unit's benefit group). `entryGroupId` = prefix + containing group. The parser computes these (`path`/`groupPath` on units, models, wargear, Prime trees, army config).
- Units carry their base cost; models carry theirs. Cost name `Point(s)`.
- Unit size: `FilledSlot.modelCounts` (by `modelKey`, only where it differs from the minimum) sets each model type's number (BSData min/max per model type; `rules/unitSize.ts`: `modelCount`, `unitPoints`, `slotPoints` — every points total goes through `slotPoints`). Default wargear scales with the count; model types at 0 aren't written. Import sums a type's selections (New Recruit splits a type by loadout). Edited with steppers in the slot editor; the tile shows "×N" once changed.
- Each root force carries required army configuration (`rules.json` `armyConfig`): Allegiance (from the roster), Cohort Doctrine and other settings (`configChoices`), others with BSData defaults; when a setting requires every choice (Knights' Advanced Reactions), all are written.
- Prime units emit `Prime Unit` with the chosen benefit (and `LB - Role`) nested inside. `FilledSlot.isPrime` makes prime-ness explicit (unset = prime iff in a Prime position). The unit keeps its own role as primary category; the Prime category sits (non-primary) on `Prime Unit`.
- Default wargear (parser `mandatoryIn`): entries with min ≥ 1 (after modifiers settled at parse time — conditions on the fielding army's catalogue, `primary-catalogue` or `force` instanceOf a catalogue, e.g. Cybernetica only in Mechanicum armies; hidden flags and group minimums too), and for each required group its default, else its first visible free option (e.g. a Skitarii sub-faction) so the export is legal; a group requiring several picks with no default takes the next options in list order (a Saturnine Praetor's two melee weapons). Shared Legiones Astartes units are parsed again per Legion: where a Legion's army differs (Iron Warriors / Thousand Sons Legionaries must exchange their bolt pistol and bolter) the defaults go in `rules.json` `legionWargear`, applied by `getUnitsForFaction`. A sub-unit's models are written as totals across the sub-units (2 Rapier crews: 4 Legionaries). Children attached to a root link (not its target) are included, with paths that drop the link id.
- Army-wide choices (`rules/armyChoices.ts`): BSData asks Skitarii/Mechanicum units for a sub-faction one unit at a time; the builder picks once per army (start screen, changeable in the header) and the export writes that pick on every unit carrying the group — except where a detachment's fixed-Trait units all share one option (BSData allows one Mechanicum Trait per detachment: Tech-Thralls are Lacrymaerta), when units there take that one (`detachmentChoices`). Options carry the category of the same name (`counts`), and the picks are counted in rule checks (`RosterOptions.armyChoices`, `unitChoiceIds`), so a real Trait conflict is a warning. Groups come from `rules.json` `armyChoices` (shared groups named "…Sub-faction(s)"); the roster stores `armyChoices: groupId → optionId`, and import reads the most common pick back.
- High Command units with a detachment choice emit "One Apex / One Auxiliary Detachment".

`importRos` reads a .ros back into forces (detachments, units in slots, Prime benefits, LB bonus slots, allegiance, doctrine; unlock links are inferred). `referenceRosters.test.ts` round-trips every file in `reference_armies/` (import → export → compare) — add New Recruit exports there to extend coverage. Unsupported root forces are skipped with a warning.

### Faction Registry & Unit Loading

`src/data/factions.ts` is the faction registry: every army the builder can field (18 Legions, Mechanicum, Skitarii, Solar Auxilia, Legio Custodes, Anathema Psykana, Questoris Familia). Each `FactionDef` names its `unitSources` (units.json keys merged at runtime — legions get `legiones-astartes` + their own), its force org `chart`, the auto-added `primaryDetachment`, and `canTakeAllies`. `getUnitsForFaction(faction)` in `loader.ts` merges the unit sources; `getAllyFactions` reads who may ally from the Allied Detachment's `sources`.

Slot matching follows BattleScribe: a slot takes units whose effective primary category equals it (prime slots take their base role, or a qualified variant that has its own slot in the detachment). See `rules/slots.ts`.

### State: Zustand Store (`src/store/rosterStore.ts` + `rosterModel.ts`)

The roster mirrors a .ros file: `forces: Force[]` — the primary army first, then any allied armies. Each `Force` has a `faction`, `kind` (`primary` | `allied`), the `chart` it's built on, and its `detachments: PlacedDetachment[]`. `kind` `lordOfWar` is a Lord of War Detachment — its own root force (the game system's chart, or the army's catalogue chart for Knights), whose single detachment holds the units directly in the .ros. Store state: `phase`, `allegiance`, `pointsLimit`, `cohortDoctrine`, `forces`; `selectPrimaryFaction` derives the army's faction.

All force logic lives as pure functions in `rosterModel.ts` (tested in `rosterModel.test.ts`); the store is a thin wrapper. Detachment ids are globally unique, so slot actions stay keyed by detachment id.

Key store actions: `startBuild` (creates the primary force with its chart's primary detachment), `addDetachment(def, { unlockedBy?, forceId? })` (an unlocked detachment joins the force of the slot that unlocked it), `addAlliedForce`, `removeForce`, `addLordOfWar`, `fillSlot`, `clearSlot`, `setLogisticalRole`, `setArmyChoice`, `removeDetachment` (cascades — removes all detachments whose `unlockedBy` starts with the removed detachment's id).

Persistence: session state is persisted with `version: 2` (v1 `{ faction, detachments }` is migrated). Saved lists use `ROSTER_SCHEMA_VERSION` 2; `migrateSnapshot` upgrades older saves. On every load `refreshUnits` replaces stored unit snapshots with current data (by entryId, then name + role), so saved lists pick up points fixes from new BSData syncs.

### Canvas (`src/components/canvas/`)

`Canvas.tsx` composes: `useRosterView` (counts, the shown detachments, warnings), `useSlotFlow` (the modal state machine and its handlers), `useCanvasViewport` (pan / zoom / long-press drag), `useConnections` (unlock lines), `canvasLayout.ts` (pure card positions) and `CanvasModals.tsx` (renders the open modal, keyed per step).

### Modal State Machine (`useSlotFlow.ts`)

All modals are coordinated by a `ModalState` discriminated union (defined in `src/types/index.ts`). `useSlotFlow` owns it and the transitions; `CanvasModals` renders the open one.

Slot interaction chains:
1. **Prime slot**: `unitPicker` → user picks unit → `primeBenefit` → user picks benefit → if logistical: `bonusSlotRoleSelector` (sets `lbRole`) → then the unlocks below
2. **Unlocks** (`startUnlocks`): a High Command unit opens one `detachmentSelector` (Apex or Auxiliary); any other unit opens as many Auxiliary selectors as it adds to the army's BSData allowance (`rules/detachmentLimits.ts` `auxiliaryUnlocks`: 2 for a Centurion as Command — Command + Officer of the Line (2) — but 1 in a "Command - Centurions Only" slot)
3. **Squad size**: a newly placed unit with a model-count range (`isSizeAdjustable`) opens in `slotEdit` when its chain ends (`sizeAfter` ref, honoured by `close()`), to set its size
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

### Phones and tablets

`useIsPhone` (`PHONE_QUERY`: below 672px, or a touch screen under 500px tall — a phone held sideways) switches the canvas to `StackedView`: the same cards in one scrolling column — each army's root detachment, then each detachment under the one whose slot unlocked it ("Unlocked by <unit>", `stackedOrder`) — with the army line (`ArmySummary` panel) on top, a sticky strip of detachment chips to jump between cards (highlighting the one in view), and the points card as a bottom bar. Below 1056px (`useIsCompactHeader`) header actions go in a menu. The canvas uses pointer events (`useCanvasViewport`): one finger pans (from cards too), two pinch-zoom, long press drags a card; `touch-action: none` keeps the browser from scrolling.

`index.scss` holds the rest: on phones modals are bottom sheets (same query as `PHONE_QUERY`); on touch devices form fields are 16px (iOS zooms into smaller ones) and the slot ✕ is hidden — the slot editor's "Remove unit" replaces it. `viewport-fit=cover` plus `env(safe-area-inset-*)` padding (`SAFE` in `PointsCard.tsx`) keeps the bars clear of notches and the home indicator. On touch devices that can share files, Export offers "Share .ros" (system share sheet; needs HTTPS) instead of a download.

### Canvas Layout

The canvas is a large `4000×3000px` div inside an `overflow: hidden` viewport container. Pan is CSS `transform: translate(panX, panY)`; ctrl/pinch zooms (trackpad or touch). Armies are stacked vertically (allied armies get a label); within an army the root detachment is anchored left (Warlord below), Apex detachments in a 2-column grid to the right, other detachments below. Row heights come from `estimateCardHeight` in `slotLayout.ts`; positions from `canvasLayout.ts`. Cards can be long-press dragged (position overrides are not persisted). SVG connector lines are rendered as an absolute-positioned overlay with `pointer-events: none`.

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | All TypeScript types + `ModalState` union |
| `src/store/rosterStore.ts` | All state + mutations |
| `src/components/canvas/Canvas.tsx` | Composes the canvas (hooks: `useRosterView`, `useSlotFlow`, `useCanvasViewport`, `useConnections`; `canvasLayout.ts`, `CanvasModals.tsx`) |
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
