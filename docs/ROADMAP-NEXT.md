# Heresy List Builder — After 1.0

_Written 2026-10-13, after Phase 7 (phones and tablets) merged. Follows [ROADMAP-1.0.md](ROADMAP-1.0.md)._

Two tracks: **Zone Mortalis** (a second game type) and **unit building** (from force-org planner towards a full list
builder). Both stay BSData-driven, and rule breaks stay warnings.

---

## Phase 8 — Zone Mortalis

BSData encodes Zone Mortalis like the Crusade chart: a game-system force entry (`Zone Mortalis`) with its own primary
detachments and links to the usual Auxiliary / Apex detachments.

| Primary detachment | Slots |
|---|---|
| Zone Mortalis Strike Force | 1 High Command, 1 Command, 4 Troops (1 Prime), 2 Heavy Assault (1 Prime) |
| Zone Mortalis Bulwark | 1 High Command, 1 Command, 2 War-engine (1 Prime), 2 Support, 2 Troops (1 Prime) |
| Zone Mortalis Linebreaker | 1 High Command, 1 Command, 2 Heavy Assault, 2 Troops, 2 Elites (1 Prime) |
| Crusade Primary Detachment | the Zone Mortalis version |

Exactly one primary (cost type "ZM Primary Detachment", min 1 / max 1). The Auxiliary and Apex allowances start at 0 and
are changed by Command, Officer of the Line, "+1 Auxiliary from High Command" and Special Assignment, using the same
cost-type modifiers the allowance code already reads.

Work:
1. Parser: read the `Zone Mortalis` chart (`GAME_SYSTEM_CHARTS`).
2. Start screen: game type (Crusade / Zone Mortalis), then the primary detachment.
3. Roster: the game type is part of the roster and saved lists; the canvas offers the chart's detachments.
4. Vehicles BSData marks "Invalid ZM Vehicle" (flyers, 3+ hull points): left out of the unit picker, warned on import.
5. Hide what Zone Mortalis doesn't use (Warlord, Lord of War, Allies — per the chart's limits).
6. Export: the `Zone Mortalis` root force, with its configuration (Allegiance, Zone Mortalis special rules, terrain,
   Advanced Reactions).
7. Verify against a Zone Mortalis list exported from New Recruit (`reference_armies/`).

---

## Unit building

Today each slot holds a unit at its minimum size with default wargear. The parsed data already has each model type's
min / max and per-model cost; option groups are not parsed.

### Step 1 — Troop numbers _(small)_
- `FilledSlot.modelCounts` (per model type); points = base cost + per-model cost × count.
- Slot editor: a stepper per model type; the slot tile shows the size.
- Export writes the counts (default wargear scales); import reads them back — the reference lists already carry real
  squad sizes, so the round-trip tests cover it.
- Check: rules that change a model max (legion traits…) — evaluate with the rules engine.

### Step 2 — Simple unit upgrades _(small–medium)_
- Single, unit-wide options with a points cost (hunter-killer missile, sergeant upgrades, grenade packs).
- Parser reads option groups; editor shows checkboxes with points.

### Step 3 — Weapon swaps _(medium–large)_
- Per-model swaps nested inside groups ("May exchange bolter for…"), with limits that scale with unit size (BSData
  `repeats` modifiers — already supported by the evaluator).
- Parser: nested groups with constraints and modifiers; roster: a choices tree per slot; editor: "N models swap X for Y";
  export: a path for every choice.
- The reference lists carry real New Recruit wargear choices: the round-trip tests are the check.

### Step 4 — Option validation _(medium)_
- Mutually exclusive choices, model-specific wargear, shared caps — as warnings.

### Step 5 — Presentation _(small)_
- Loadouts on cards and in the text export; on phones the slot editor becomes a full-screen unit builder.

Steps 1 and 2–3 can ship separately; after Step 3, exports should open in New Recruit without needing fixes.
