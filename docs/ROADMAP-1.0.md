# Heresy List Builder — Road to 1.0

_Written 2026-10-12. Based on a review of the codebase (21 commits, Apr–Oct 2026) and the current upstream BSData repo._

## The product (restated)

A **visual** list builder for Horus Heresy 3rd Edition, drawing on the open-source BSData lists.
Heresy's force org is a web of unlocks: Command/High Command choices open Auxiliary/Apex detachments, Prime slots grant
benefits, some benefits add slots, Officer of the Line double-unlocks, doctrines boost specific detachments. That is hard
to follow in BattleScribe / New Recruit. This app shows it as **cards on a table, with options appearing progressively as
you make choices**.

### 1.0 scope decisions

| Question | Decision |
|---|---|
| Builder depth | **Force-org + points planner** (option A). Full unit configurator is a possible future; nothing in 1.0 may block it. |
| Finishing a list | **Rock-solid `.ros` export** that opens in New Recruit cleanly so the list can be fleshed out there. |
| Data source | **BSData only.** Battle Journal content comes in via whatever BSData has encoded. |
| Factions for 1.0 | 18 Legions, Solar Auxilia, Mechanicum, **Skitarii**, **Questoris Familia (Knights, standalone)**, **Legio Custodes + Sisters of Silence (Talons of the Emperor)** |
| Roadmap, not 1.0 | Titans, Imperialis Militia, Blackshields, Shattered Legions, Daemons, Knights-Errant, Assassins, Zone Mortalis, full configurator |
| Allies | **Yes**, in 1.0 |
| Restructure | Allowed, as long as BSData stays the source |
| Rule violations | **Warnings**, never blocking |

---

## Where we are today

### What's working
- The visual concept works. The card canvas, unlock connectors, Prime → benefit → bonus-slot chain, Officer of the Line, and SA cohort doctrines all function.
- `.ros` export exists. It has been through several fix passes (models, default wargear, unit-level wargear, categories).
- Saved lists, pan/zoom, card drag.

### Critical findings

**1. The data pipeline is broken.** On 2026-07-14, BSData migrated from `.cat`/`.gst` XML to `.json` ("Migrate to JSON" commit).
`npm run sync-data` now 404s on every file. `data/parsed/` was last generated 2026-05-26, so we're missing about five months of
upstream fixes, including FAQ v1.3 (merged 2026-10-12), points corrections and Journal content.

**2. Rules that are already in the data are hardcoded in the app.** BSData encodes all of these; we copied them by hand, sometimes wrongly:

| Hardcoded in app | Where it really lives in BSData |
|---|---|
| `PRIME_BENEFITS` (6 entries, made-up descriptions, a placeholder "Legion Specific") | Per-unit `Prime Benefits` group → `Common Prime Benefits` (Combat Veterans, Special Assignment, Master Sergeant, Paragon of Battle, Logistical Benefit, **Teleport Transponders, Clade Operative, Cult Operative**) + `Legion Prime Benefits`, `Mechanicum Prime Benefits`, `Custodes Prime Benefits`, `Household Rank Prime Advantages` (Knights), `Vagus Prime Benefits`, … with real rules text |
| `OFFICER_OF_THE_LINE_UNITS` | Categories `Officer of the Line (2)` / `(3)` |
| `COHORT_DOCTRINES` | Categories `Cohort Doctrine: *` + `* Tercio Unlock` |
| Faction restrictions via `FACTION_COMMENT_MAP` (XML comment strings) | `instanceOf primary-catalogue` conditions on force entries / category links (comments still exist as a fallback) |
| LB-role / "One Apex/Auxiliary Detachment" IDs in `buildRos.ts` | Selection entries in the gst |
| Detachment unlocks | `* Unlock` categories (e.g. `Medusan Vanguard Unlock`, `The Hammer of Olympia Unlock`), `+1 Apex from High Command`, `+1 Auxiliary from High Command` |

Each hardcoded rule is a bug waiting for the next FAQ.

**3. The faction model can't express the new factions.** Faction behaviour is `SM_LEGION_KEYS` (merge Legiones Astartes units) plus
`faction === 'solar-auxilia'` checks. Knights use their **own root force chart** (`Knight Households Crusade` in Questoris
Familia, not the Crusade chart). Skitarii also have their own force entries. Allies are a second root force (`Allied Detachment and its Auxiliary`).
The current roster is a flat `detachments[]` list under one implied force, which can't represent this.

**4. Units are snapshotted, not referenced.** `FilledSlot.unit` stores a full copy of `UnitEntry`. Saved lists keep stale points
after a data update, and there's nowhere to hang future option selections.

**5. No validation.** Nothing checks compulsory slots, the points limit, Lord of War/ally caps, allegiance-locked units, unique
characters or Warlord rules.

**6. Code health.**
- `Canvas.tsx` (810 lines) mixes viewport pan/zoom/drag, layout, connector measurement and the whole modal state machine.
- `isEditingSlot` / `pendingDoubleUnlock` refs are hidden state on top of `ModalState`.
- Only 7 tests, all on export.
- Docs have drifted: CLAUDE.md describes a removed List View, and the README says plaintext export.

---

## Guiding architecture principle

> **The app is a visual shell over BSData's own force/selection tree. Store BSData IDs, not copies, and mirror the `.ros` structure.**

When the roster model *is* the `.ros` shape (roster → forces → child forces → selections, each with `entryId` paths), these follow:

- **Export becomes serialisation.** No reconstruction and no guessed IDs, which is where "rock solid" comes from.
- **Allies are just another force.**
- **The full configurator stays open.** It's adding child `selections` under a unit selection; the model is already there.
- **`.ros` import** (open a New Recruit roster on the canvas) becomes feasible later.

### Proposed core types (sketch)

```ts
// Data layer (generated from BSData JSON)
interface Catalogue { id; name; revision; links: CatalogueLink[] }
interface ForceEntryDef { id; name; kind: 'root'|'primary'|'auxiliary'|'apex'|'warlord'|'lordOfWar'|'allied'|...;
                          slots: SlotDef[]; children: string[]; availability: Condition[]; modifiers: Modifier[] }
interface UnitDef { entryId; catalogueId; name; categories: string[]; baseCost; models: ModelDef[];
                    primeBenefitGroupIds: string[]; unlocks?: ...; officerOfTheLine?: number }
interface PrimeBenefitDef { entryId; name; rulesText; restrictions: Condition[] }

// Roster layer (mirrors .ros)
interface Roster { id; name; dataRevision; pointsLimit; forces: Force[] }
interface Force  { id; forceEntryId; catalogueId; armySelections: Selection[]; // allegiance, doctrine, Archmagos type…
                   children: Force[] /* detachments */; slots: Record<slotKey, Selection|null>; unlockedBy? }
interface Selection { id; entryId; /* path */ number; primeBenefitEntryId?; children: Selection[] /* future configurator */;
                      notes?; extraPoints? }
```

### Rules engine-lite

BattleScribe logic is constraints (`min`/`max`) plus modifiers (`set`/`increment`) gated by conditions (`atLeast`, `instanceOf`,
`equalTo`, scoped to `self`/`parent`/`force`/`roster`/`primary-catalogue`). For force-org purposes, a **small, well-tested
evaluator over that subset** gives us:
- slot counts per detachment (including increments from unlock categories, doctrines and Logistical Benefits)
- which detachments are available to the primary catalogue (replaces `FACTION_COMMENT_MAP`)
- which prime benefits a unit can take in a given slot
- validation warnings for free: an unmet `min` or exceeded `max` *is* a warning

Recommendation: **build this as a pure TS module with fixture tests**, not ad-hoc lookups. It's the piece that keeps the
configurator path open. Unit options use the same constraint/modifier language.

---

## Phased plan

### Phase 0 — Stabilise (small)
- Fix doc drift (CLAUDE.md List View, README export format, faction list).
- Show the BSData revision / sync date in the UI (footer or About).
- Run `npm test -- --run` and `tsc` in the existing GitHub Actions workflow before deploy.
- Capture **golden fixtures**: for 3–4 representative current lists (DG, SA, Mech, a Legion with Officer of the Line), save the
  roster JSON plus exported `.ros` as regression baselines for the rewrite.

### Phase 1 — Data pipeline on BSData JSON (the unblocker)
- Replace `scripts/parse-cats.ts` (regex XML) with a JSON loader: fetch the catalogue list from the repo tree instead of a hardcoded file list.
- Build a **resolved index**: follow `entryLinks` → `sharedSelectionEntries`/`Groups`, `categoryLinks` → `categoryEntries`, `infoLinks` → rules/profiles, across `catalogueLinks` (honouring `importRootEntries`).
- Emit a compact runtime bundle: force entries (with constraints/modifiers kept raw for the evaluator), units, prime-benefit groups, categories, rules text.
- Split output per catalogue so the app can lazy-load factions (Legiones Astartes alone is 6.5 MB of source).
- Tests: parser snapshot tests on a pinned BSData commit, plus "every faction has ≥1 unit for every compulsory slot" sanity checks.
- Remove `fast-xml-parser` if it's no longer needed.

### Phase 2 — Domain model, faction registry, allies
- New `Roster`/`Force`/`Selection` model (above) in the Zustand store. Saved-list `schemaVersion` 2 with a v1 → v2 migrator (map snapshot units to `entryId`s).
- **Faction registry** (data-driven, small hand config only where BSData can't tell us):
  ```ts
  { id: 'questoris-familia', label: 'Questoris Familia', catalogueId: 'fd9b-…', rootForceEntryId: '<Knight Households Crusade>',
    group: 'Knights', armyOptions: [...] }
  ```
  `armyOptions` comes from `Army Configuration` entries: cohort doctrine (SA), Archmagos discipline (Mech), Household rank (Knights), and so on. This replaces the SA-only special case.
- **Allies**: an "Add Allied Detachment" action creates a second root force (`Allied Detachment and its Auxiliary`) with its own catalogue, rendered as a visually distinct card cluster. Its availability and caps come from the evaluator.
- Load units from the primary catalogue plus its `catalogueLinks` (generalises the LA merge, and covers Divisio Assassinorum and similar where linked).

### Phase 3 — Rules engine-lite + progressive reveal from data
- Implement the evaluator (above); delete `PRIME_BENEFITS`, `OFFICER_OF_THE_LINE_UNITS`, `COHORT_DOCTRINES`, and the hardcoded IDs in `buildRos.ts`.
- Prime benefit modal lists the **real** per-unit benefits with BSData rules text (fixes missing Teleport Transponders, Clade/Cult Operative, and every faction-specific one).
- Detachment selector driven by evaluator availability. Unlock connectors driven by the `* Unlock` / `Officer of the Line (N)` categories.

### Phase 4 — Export hardening ("rock solid")
- Export = serialise the roster tree. Forces/child forces/selections carry real `entryId` paths, catalogue IDs, revisions, and army-configuration selections (allegiance, doctrine, etc.).
- Prime benefits exported as their real upgrade selections under the unit.
- Allied forces exported as sibling root forces with their own `catalogueId`.
- **Acceptance test per 1.0 faction**: build a list → export → import into New Recruit → **no errors, same points total, same detachments**. Keep each exported `.ros` as a fixture, plus automated structural tests (every `entryId` resolves in the bundle, every force `entryId` is a valid child of its parent).
- Stretch: `.ros` import onto the canvas.

### Phase 5 — Validation warnings
- Evaluator `min`/`max` violations surface as card badges plus a list-level warnings panel next to the points card.
- Also: over points limit, ally/Lord of War caps, allegiance-locked units, unique characters, missing Warlord.
- Warnings never block building or export.

### Phase 6 — Faction rollout & QA (in this order)
1. **Legions + Solar Auxilia + Mechanicum.** Regression against the golden fixtures; verify Mech `Logistical Benefits Detachment`, Archmagos disciplines and Taghmata/Apex chains.
2. **Skitarii Conclaves.** Primary in the Crusade chart, plus the "Skitarii Allies for Mech" force.
3. **Legio Custodes + Anathema Psykana** (Talons of the Emperor convocations, Moritoi Apex).
4. **Questoris Familia** (own force chart: Primary, Armiger Talon, Automata Talon, Support Banner, Yeomanry Mesnie, Knight Lord of War).
5. **Allies** across all of the above.

### Phase 7 — UX & code quality (alongside the other phases)
- Split `Canvas.tsx`:
  - `useViewport` (pan/zoom/drag)
  - pure `layoutCards()` with tests
  - `useConnectors`
  - a `slotFlow` reducer that owns the modal chain, absorbing the `isEditingSlot` / `pendingDoubleUnlock` refs into explicit state
- Card visuals per faction group (Legion / Mechanicum / Auxilia / Knights / Talons), plus a clear "this unlocked that" highlight on hover.
- Store tests for unlock cascades and removal; evaluator fixture tests; export fixture tests.

---

## 1.0 definition of done
- [ ] `npm run sync-data` works against current BSData; the data revision is shown in the app
- [ ] All 1.0 factions buildable, including allies
- [ ] Zero hardcoded rule tables (prime benefits, unlocks, doctrines, OotL, faction restrictions all from data)
- [ ] For each 1.0 faction, a reference list exports and imports into New Recruit with no errors and matching points
- [ ] Validation warnings for compulsory slots, points, caps, uniqueness, allegiance
- [ ] Saved v1 lists migrate cleanly
- [ ] CI runs tests and typecheck before deploy; docs match reality

## Post-1.0 roadmap
- Factions: Legio Titanicus, Imperialis Militia, Blackshields, Shattered Legions, Daemons, Knights-Errant, Divisio Assassinorum (standalone)
- Zone Mortalis force charts (already in BSData)
- `.ros` import
- **Full unit configurator**: model counts and wargear as child `Selection`s, using the same evaluator

## Open questions to verify during the work
- How New Recruit expects allied forces to be nested (sibling root force vs. child). Confirm against a New Recruit-exported roster.
- Sisters of Silence: is the expected shape a Custodes primary with Anathema Psykana units via convocations, an allied force, or both? BSData references both catalogues in the Crusade chart's conditions.
- Whether upstream catalogue `revision` numbers are reliable for change detection. Several catalogues show the same revision as our May data despite many commits since.
