# Heresy List Builder Export Analysis

## Problem Summary

When exporting from the app (pre), essential unit data is missing compared to what Battlescribe/New Recruit expects. The -post file shows all missing details that must be automatically added during export.

## Critical Missing Elements

### 1. **Default Wargear (Mandatory Items)**

Every unit has wargear that's **required by BSData constraints** but the app doesn't export them:

#### Breacher Squad (All Roles)
- **Boarding shields** - `min="1"` constraint in BSData
  - Grants `5+ Invulnerable Save`
  - Adds `Shield Trait`
  - Grants `Heavy Sub-Type`
  - Affects Toughness and armor saves
  
- **Frag grenades** - `min="1"` constraint
  - `Blast (3")` special rule
  - Range 6", Firepower 1, RS 3
  - AP 6, Damage 1
  
- **Krak grenades** - `min="1"` constraint
  - `Detonation` special rule (melee only)
  - Ignore Armor saves on 6+
  - AP 4, Damage 2

#### Tactical Squad
- **Frag grenades** - Standard issue to all troopers
- **Krak grenades** - Standard issue to all troopers

#### Master of Signals (Officer)
- **Command vox relay** - Completely absent in -pre export
  - Affects reserves, comms, line/vanguard tactics
  - Wargear profile with full description

#### Pattern for All Infantry
- **All basic infantry squads need Frag + Krak grenades**
- Special squads (Breachers) need additional wargear (shields)
- Officers/Sergeants need specialized wargear (vox relay, etc.)

### 2. **Unit-Level Rules** (Not on models - on the unit)

These appear as `<rules>` elements on the unit selection, not individual models:

#### Breacher Squad
```xml
<rule name="Line (1)" typeId="...">
  <description>Controls objectives more effectively</description>
</rule>

<rule name="Shield" typeId="..." typeName="Traits">
  <!-- Applied because units have boarding shields -->
</rule>

<rule name="Shieldwall!" typeId="c14c-ecfd-ea65-58c9" typeName="Reaction">
  <description>Can increase Toughness +1 vs shooting when majority have Shield trait</description>
</rule>
```

#### Tactical Squad
```xml
<rule name="Line (2)" typeId="...">
  <description>Troops role - better objective control than Breachers</description>
</rule>

<rule name="Fury of the Legion" typeId="...">
  <description>Death Guard legion tactica - Bolters gain Heavy (FP) until attack resolves</description>
</rule>
```

#### Master of Signals
```xml
<rule name="Infantry Type" typeId="...">
<rule name="Command Sub-Type" typeId="...">
```

**All Faction Units:**
```xml
<profile name="Death Guard" typeId="d5a9-9164-1e30-7a35" typeName="Traits"/>
<profile name="Traitor" typeId="d5a9-9164-1e30-7a35" typeName="Traits"/>
```

### 3. **Model Profiles** (Full characteristics)

Currently export only shows models by name and cost. Need full profile with all characteristics:

```xml
<profile name="Breacher Legionary" typeId="a76f-8e23-8c3e-166d" typeName="Profile">
  <characteristic name="Type">Infantry (Heavy)</characteristic>
  <characteristic name="M">7</characteristic>
  <characteristic name="WS">4</characteristic>
  <characteristic name="BS">4</characteristic>
  <characteristic name="S">4</characteristic>
  <characteristic name="T">4</characteristic>
  <characteristic name="W">1</characteristic>
  <characteristic name="I">4</characteristic>
  <characteristic name="A">1</characteristic>
  <characteristic name="LD">7</characteristic>
  <characteristic name="CL">7</characteristic>
  <characteristic name="WP">7</characteristic>
  <characteristic name="IN">7</characteristic>
  <characteristic name="SAV">3+</characteristic>
  <characteristic name="INV">5+</characteristic>
</profile>
```

Each model type needs its own profile section attached to the model selection.

### 4. **Weapon Profiles**

Grenades and other weapons must include `<profiles>` with weapon characteristics:

```xml
<selection name="Frag grenades" entryId="...">
  <rules>
    <rule name="Blast (3&quot;)"> ... </rule>
  </rules>
  <profiles>
    <!-- Wargear profile -->
    <profile name="Frag grenades" typeId="5ec5-e0c3-1701-6f16" typeName="Wargear">
      <characteristic name="Summary">Can be used in Volley step</characteristic>
      <characteristic name="Description">Detailed rules...</characteristic>
    </profile>
    <!-- Weapon profile -->
    <profile name="Frag grenades" typeId="c591-09ed-3e6f-eb2b" typeName="Ranged Weapon">
      <characteristic name="R">6</characteristic>
      <characteristic name="FP">1</characteristic>
      <characteristic name="RS">3</characteristic>
      <characteristic name="AP">6</characteristic>
      <characteristic name="D">1</characteristic>
      <characteristic name="Special Rules">Blast (3&quot;)</characteristic>
      <characteristic name="Traits">Assault</characteristic>
    </profile>
  </profiles>
</selection>
```

## Implementation Requirements

### Phase 1: Data Structure Enhancements

1. **Extend `UnitEntry` type** to track:
   - Required wargear with `min="1"` constraints from BSData
   - Unit-level rules that apply to the whole unit
   - Model profile data (full stat lines)
   - Special traits/reactions

2. **Create wargear/rule lookup tables** from BSData:
   - Map unit entry IDs to required `<entryLink>` items (shields, grenades, vox relays)
   - Extract all `<rule>` definitions linked to each unit
   - Extract full `<profile>` characteristics for each model type

### Phase 2: Export Function Enhancement

Update `buildRos.ts` to:

1. **Look up unit in BSData** by entryId
2. **Extract and apply constraints**:
   - Find all `<entryLink>` with `constraint[@type="min"][@value="1"]`
   - Add these as required selections with full profiles + rules
3. **Emit `<rules>` section** with:
   - Unit-level special rules
   - Faction traits (Death Guard, Traitor)
   - Role-based rules (Line X, etc.)
   - Reactions and advanced rules
4. **Emit `<profiles>` section** for each model with:
   - Full stat characteristics (M, WS, BS, S, T, W, I, A, LD, CL, WP, IN, SAV, INV)
5. **For each required wargear selection**, emit:
   - Full `<profiles>` with both wargear and weapon characteristics
   - All associated `<rules>` (Blast, Detonation, etc.)

### Phase 3: BSData Parser Enhancement

Update `scripts/parse-cats.ts` to:

1. **Extract minimum constraints** for each unit:
   ```typescript
   // For each selectionEntry, find <entryLink>s with min="1"
   // Create new field: requiredWargear: WargearEntry[]
   ```

2. **Build rule registry**:
   ```typescript
   // For each unit and its linked <rule> elements
   // Map entryId → List of rules with full descriptions
   ```

3. **Extract model profiles**:
   ```typescript
   // For each <selectionEntry type="model">
   // Extract <profile> with all <characteristic> values
   ```

## Affected Units (By Severity)

### High Priority (Most Broken)
- **Breacher Squad** - Missing shields, grenades, reactions
- **Master of Signals** - Missing vox relay completely
- **All Terminators** - Missing heavy armor profiles, weapons

### Medium Priority  
- **Tactical Squads** - Missing grenades, legion rules
- **Command Units** - Missing officer-specific wargear
- **Tac Officers** - Missing special rules

### Lower Priority (Fewer Omissions)
- **Vehicles** - Generally minimal wargear, but need weapon profiles
- **Standalone Characters** - Usually complete, but need all rules

## Quick Fix Checklist

- [ ] Add `defaultWargear` field population in parser for all units
- [ ] Extract unit-level rules and attach to unit selections
- [ ] Include model profile characteristics in export
- [ ] Add weapon profile data (R, FP, RS, AP, D, Special Rules, Traits)
- [ ] Emit `<rules>` sections with all associated rules
- [ ] Emit `<profiles>` sections for models
- [ ] Map grenade selections to include both Wargear AND Ranged Weapon profiles
- [ ] Add faction traits to every unit selection
- [ ] Test with all unit types across multiple factions

## BSData Lookup Reference

Key file: `data/raw/legiones-astartes.cat` (and faction-specific .cat files)

Search patterns:
- `<selectionEntry type="unit" name="[UNIT_NAME]"` - Unit definition
- `<entryLink ... targetId="..."` - Linked items (wargear, rules)
- `<constraint type="min"` - Required items
- `<profile ... typeId="a76f-8e23-8c3e-166d"` - Model profiles
- `<rule ... typeId="..."` - Rules and reactions

