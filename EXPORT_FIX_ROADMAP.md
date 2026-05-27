# Export Fix: Universal Patterns & Action Items

## Universal Pattern for All Units

### Three-Tier Structure Required in Export

```
UNIT
├── <rules>           ← Unit-level rules (apply to whole unit)
├── <profiles>        ← Faction traits + unit traits + reactions
└── <selections>      ← Models and wargear
    ├── MODEL 1
    │   ├── <rules>        ← Model type rules (Infantry, Heavy, etc.)
    │   ├── <profiles>     ← Model profile (stats M, WS, BS, S, T, W, I, A, LD, CL, WP, IN, SAV, INV)
    │   └── <selections>   ← Weapon/wargear with THEIR rules + profiles
    ├── MODEL 2
    │   ├── <rules>
    │   ├── <profiles>
    │   └── <selections>
    └── WARGEAR 1
        ├── <rules>        ← Special rules (Blast, Detonation, etc.)
        └── <profiles>     ← Wargear + weapon profiles (grenades have BOTH)
```

## What Gets Added for Each Unit Type

### Infantry Squads (Tactical, Assault, Tactical Support, etc.)
**Auto-add to every trooper model:**
- Bolt pistol (if not already shown)
- **Frag grenades** (mandatory)
- **Krak grenades** (mandatory)

**Add to unit:**
- Line (X) rule (where X = role bonus: Troops=2, etc.)
- Fury of the Legion (for legions that have it)
- All faction traits

**Per model:**
- Infantry Type rule
- Model profile with full 13 stats

### Heavy/Assault Squads (Terminators, Breachers, etc.)
**All of the above PLUS:**
- **Boarding shields** (if heavy infantry with 3+ save)
- **Servo-arm** or other melee weapons
- Shield trait
- Shieldwall! reaction

**Per model:**
- Heavy Sub-Type rule
- Sergeant Sub-Type (for sergeant)
- Profile with updated saves (heavier armor)

### Command/Officer Models
**All infantry basics PLUS:**
- **Command vox relay** (mandatory for officers)
- **Refractor field** or invuln gear (if applicable)
- Command Sub-Type rule
- Officer title traits

**Per model:**
- Command Sub-Type rule (special)
- Full leadership characteristics
- LD, CL, WP at officer level

### Vehicles & Dreadnoughts
**Standard for all:**
- Vehicle Type rule
- Full stat profile (with M, T, W, SVG, INV, etc.)
- Weapon loadout with FULL weapon profiles
- Hull points / damage track rules

**Special:**
- Reactor rules
- Armor facings (if applicable)
- Gun-mounted hardpoints

## Step-by-Step Implementation

### Step 1: Parser Enhancement
**File: `scripts/parse-cats.ts`**

Add extraction for:
```typescript
// For each UnitEntry, find linked items with constraints
interface ConstrainedWargear {
  entryId: string;
  name: string;
  min: number;
  max: number;
  isRequired: boolean; // min >= 1
}

// Extract from <entryLink>s under selectionEntry
const requiredWargear: ConstrainedWargear[] = []; 
// Then build field: unit.requiredWargear = requiredWargear
```

### Step 2: BSData Lookup Service
**Create new file: `src/utils/bsDataLookup.ts`**

Functions needed:
```typescript
// Get all rules for a unit entry
function getUnitRules(entryId: string): RuleDefinition[] {}

// Get model profile for a model entry
function getModelProfile(entryId: string): ProfileCharacteristics {} 

// Get wargear definition (profiles + rules)
function getWargearDefinition(entryId: string): WargearDefinition {}

// Get all required wargear for a unit
function getRequiredWargear(unitEntryId: string): WargearDefinition[] {}
```

This service reads from loaded BSData files and caches results.

### Step 3: Export Function Enhancement
**File: `src/utils/buildRos.ts`**

New helper functions:
```typescript
function emitUnitRules(lines: string[], unit: UnitEntry, indent: string): void {
  // Look up unit rules from BSData via bsDataLookup service
  // Emit all <rule> elements
}

function emitUnitProfiles(lines: string[], unit: UnitEntry, indent: string): void {
  // Always include: faction traits (Death Guard, Traitor, etc.)
  // Add: unit-specific traits (Shield, etc.)
  // Add: reactions (Shieldwall!, etc.)
}

function emitModelProfile(lines: string[], model: ModelEntry, modelType: string, indent: string): void {
  // Get profile from BSData
  // Emit with all characteristics (M, WS, BS, S, T, W, I, A, LD, CL, WP, IN, SAV, INV)
}

function emitWargearSelection(lines: string[], wargear: WargearDefinition, indent: string): void {
  // Emit complete wargear selection with:
  // - Full <profiles> (wargear + weapon profiles)
  // - Associated <rules> (Blast, Detonation, etc.)
}
```

### Step 4: Testing & Validation

Test each unit type:
- [ ] Tactical Squad (Troops role, grenades, Line 2)
- [ ] Assault Squad (Fast Attack role, grenades, Line 1)
- [ ] Breacher Squad (Troops, shields, grenades, Line 1, Shieldwall)
- [ ] Terminators (Heavy Assault, heavy armor, special weapons)
- [ ] Master of Signals (Command, vox relay)
- [ ] Dreadnoughts (Vehicle rules, weapon profiles)

Validation checks:
- [ ] All required wargear present (min=1 constraints met)
- [ ] No duplicate rules
- [ ] Profile stats reasonable (not negative, match BSData)
- [ ] Weapon characteristics complete (R, FP, RS, AP, D not missing)
- [ ] Re-import into Battlescribe - zero errors

## Specific Issues Per Unit

### Master of Signals (Critical)
**Currently missing:**
- [ ] Command vox relay completely absent
- [ ] Infantry Type rule missing
- [ ] Command Sub-Type rule missing
- [ ] Model profile with stats missing
- [ ] Both Frag + Krak grenades missing

**Fix:**
1. Mark vox relay as required in parser
2. Extract vox relay profile from BSData
3. Add Command Sub-Type + Infantry Type rules
4. Emit model profile with officer-level stats
5. Add grenades as required wargear

### Breacher Squad (High Priority)
**Currently missing:**
- [ ] Boarding shields (required by BSData)
- [ ] Shield trait (automatically applied by shields)
- [ ] Shieldwall! reaction
- [ ] Frag + Krak grenades
- [ ] Model profiles for all models
- [ ] Heavy Sub-Type rule

**Fix:**
1. Mark shields, grenades as required
2. Extract all profiles from BSData
3. Look up and add Shieldwall! reaction
4. Add Heavy Sub-Type + model stats
5. Include all weapon profiles

### Tactical Squad (Medium Priority)
**Currently missing:**
- [ ] Frag + Krak grenades
- [ ] Line (2) rule (Troops bonus)
- [ ] Fury of the Legion rule (legion tactica)
- [ ] Faction traits (Death Guard, Traitor)
- [ ] Model profiles for Sergeant + Legionaries
- [ ] Full weapon characteristics

**Fix:**
1. Add grenades to required wargear list
2. Look up unit rules: Line (2), Fury of the Legion
3. Add faction traits automatically
4. Extract model profiles
5. Emit weapon profiles (Bolter stats)

### Grave Warden Terminators (Medium Priority)
**Currently missing:**
- [ ] Full terminator armor profiles
- [ ] Weapon loadout profiles (combi-weapons, etc.)
- [ ] Special abilities (Invul saves)
- [ ] Chem-master special rules
- [ ] Model profiles

**Fix:**
1. Extract terminator armor model profiles
2. Get all weapon definitions
3. Add model-specific rules
4. Include special characteristics

## Data Files to Reference

**BSData sources:**
- `data/raw/legiones-astartes.cat` - Base units, shared
- `data/raw/death-guard.cat` - DG-specific options
- `data/raw/horus-heresy-3rd-edition.gst` - System-wide rules

**Search strings in BSData:**
- `<selectionEntry type="unit" name="[UNIT_NAME]"` - Find unit definition
- `<entryLink ... targetId="` - Find linked items
- `<constraint type="min" value="1"` - Find required items  
- `<profile typeId="a76f-8e23-8c3e-166d"` - Find model profiles
- `<rule id="` - Find rule definitions with IDs

## Priority Order for Implementation

1. **Extract `defaultWargear` properly** (Parser update) - 1 day
2. **Create BSData lookup service** (New file) - 2 days
3. **Update buildRos to emit rules+profiles** (File enhancement) - 2-3 days
4. **Add model profile extraction** (Parser update) - 1 day
5. **Test and validation** - 2 days

**Total estimated: 8-10 days for complete fix**

**Quick wins (1-2 day fixes):**
- Just add grenades to `defaultWargear` for all infantry → 70% better
- Emit basic faction traits → eliminates Battlescribe warnings
- Include model profiles (no stats needed initially) → fixes structure

