# Side-by-Side Export Comparison

## Breacher Squad Example

### Current (PRE) - What We Export
```xml
<selection id="cc6c35c4..." name="Breacher Squad" entryId="182a-8bcd-34d2-fbba" number="1" type="unit">
  <selections>
    <selection id="fe105939..." name="Sergeant" entryId="5809-c342-b9e6-740a" number="1" type="model">
      <costs>
        <cost name="pts" value="0" costTypeId="..."/>
      </costs>
    </selection>
    <selection id="a19dd427..." name="Legionary" entryId="4aab-6f78-9ab5-3c0b" number="9" type="model">
      <selections>
        <selection name="Bolt pistol" entryId="6d6d-84c3..." number="9" type="upgrade">
          <costs>
            <cost name="pts" value="0" costTypeId="..."/>
          </costs>
        </selection>
      </selections>
      <costs>
        <cost name="pts" value="108" costTypeId="..."/>
      </costs>
    </selection>
  </selections>
  <categories>
    <category id="..." name="Troops" primary="true" entryId="88e6-d373..."/>
  </categories>
  <costs>
    <cost name="pts" value="140" costTypeId="..."/>
  </costs>
</selection>
```

### What Battlescribe/New Recruit Expects (POST)
```xml
<selection id="cc6c35c4..." name="Breacher Squad" entryId="182a-8bcd-34d2-fbba" 
           number="1" type="unit" from="entry">
  <!-- ✨ NEW: Unit-level rules section -->
  <rules>
    <rule id="1b5d-ceec..." name="Line (1)" hidden="false" page="302">
      <description>A Unit of Models with this Special Rule can control Objectives...</description>
    </rule>
  </rules>
  
  <!-- ✨ NEW: Faction traits -->
  <profiles>
    <profile id="bb66-f1f6..." name="Traitor" typeId="d5a9-9164-1e30-7a35" typeName="Traits" from="entry">
      <characteristics>
        <characteristic name="Description" typeId="d5eb-0b8b-0f26-6233"></characteristic>
      </characteristics>
    </profile>
    <profile id="641c-ca0a..." name="Death Guard" typeId="d5a9-9164-1e30-7a35" typeName="Traits" from="entry">
      <characteristics>
        <characteristic name="Description" typeId="d5eb-0b8b-0f26-6233"></characteristic>
      </characteristics>
    </profile>
    <profile id="1af7-07d5..." name="Shield" typeId="d5a9-9164-1e30-7a35" typeName="Traits" from="entry">
      <characteristics>
        <characteristic name="Description" typeId="d5eb-0b8b-0f26-6233"></characteristic>
      </characteristics>
    </profile>
    <!-- ✨ NEW: Shieldwall reaction -->
    <profile id="e70e-0849..." name="Shieldwall!" typeId="c14c-ecfd-ea65-58c9" typeName="Reaction" from="entry">
      <characteristics>
        <characteristic name="Summary" typeId="5d02-0e54-0f6a-0f0b">
          This Reaction allows the Reactive Player to gain a bonus to the Toughness...
        </characteristic>
        <!-- ... full trigger, cost, target, process details ... -->
      </characteristics>
    </profile>
  </profiles>
  
  <selections>
    <!-- Sergeant -->
    <selection id="fe105939..." name="Sergeant" entryId="182a-8bcd-34d2-fbba::5809-c342-b9e6-740a" 
               number="1" type="model" from="entry">
      <!-- ✨ NEW: Model rules -->
      <rules>
        <rule id="3888-5604..." name="Sergeant Sub-Type" hidden="false" page="177">
          <description>The Controlling Player of a Unit that includes one or more Models...</description>
        </rule>
        <rule id="6740-4d5b..." name="Infantry Type" hidden="false" page="174">
          <description>Infantry is the most basic Type...</description>
        </rule>
        <rule id="c625-7b16..." name="Heavy Sub-Type" hidden="false" page="177">
          <description>The following Rules apply to all Models with the Heavy Sub-Type...</description>
        </rule>
      </rules>
      
      <!-- ✨ NEW: Model profile with full stats -->
      <profiles>
        <profile id="dfd4-9125..." name="Breacher Sergeant" typeId="a76f-8e23-8c3e-166d" typeName="Profile" from="entry">
          <characteristics>
            <characteristic name="Type" typeId="50fc-9241-d4a2-045b">Infantry (Sergeant, Heavy)</characteristic>
            <characteristic name="M" typeId="a106-a779-d272-5e93">7</characteristic>
            <characteristic name="WS" typeId="253c-d694-4695-c89e">4</characteristic>
            <characteristic name="BS" typeId="0cd5-b269-e3bc-028b">4</characteristic>
            <characteristic name="S" typeId="498f-dce1-59fd-d8d7">4</characteristic>
            <characteristic name="T" typeId="3120-8275-e537-ecd2">4</characteristic>
            <characteristic name="W" typeId="f5cc-79a3-d302-cc1d">1</characteristic>
            <characteristic name="I" typeId="af9d-7db8-dc95-71c1">4</characteristic>
            <characteristic name="A" typeId="024e-bdb1-7982-25a0">1</characteristic>
            <characteristic name="LD" typeId="02ad-ebe6-86e7-9fd6">8</characteristic>
            <characteristic name="CL" typeId="9cd1-0e7c-2cd6-5f2f">7</characteristic>
            <characteristic name="WP" typeId="f714-1726-37d3-44df">7</characteristic>
            <characteristic name="IN" typeId="29c5-925d-5b1d-1e77">7</characteristic>
            <characteristic name="SAV" typeId="03bd-4ecb-351d-143b">3+</characteristic>
            <characteristic name="INV" typeId="a951-a772-7ce0-0b64">5+</characteristic>
          </characteristics>
        </profile>
      </profiles>
      
      <selections>
        <!-- Sergeant's weapons - now with profiles -->
        <selection id="op86wfb..." name="Bolt pistol" entryId="182a-8bcd-34d2-fbba::cee1-204c-3eaf-cf3f::2942-f783-d627-33c5" 
                   entryGroupId="182a-8bcd-34d2-fbba::c8c9-8091-f181-6929" number="1" type="upgrade" from="group" group="Options::May exchange bolt pistol for">
          <rules>
            <rule id="2bf6-55c8..." name="Pistol" hidden="false" page="306">
              <description>A Model may attack with two Weapons that have the Pistol Special Rule...</description>
            </rule>
          </rules>
          <profiles>
            <profile id="8942-0add..." name="Bolt pistol" typeId="c591-09ed-3e6f-eb2b" typeName="Ranged Weapon" from="entry">
              <characteristics>
                <characteristic name="R" typeId="cdb0-8654-6840-1037">12</characteristic>
                <characteristic name="FP" typeId="5037-1f27-1790-e355">1</characteristic>
                <characteristic name="RS" typeId="b9da-ee13-79f9-fa63">4</characteristic>
                <characteristic name="AP" typeId="7a23-0248-2b94-5951">5</characteristic>
                <characteristic name="D" typeId="88c3-1ca5-7dc1-f291">1</characteristic>
                <characteristic name="Special Rules" typeId="5aad-137a-8ee2-63fd">Pistol</characteristic>
                <characteristic name="Traits" typeId="1247-79d2-6cc1-8a03">Assault, Bolt</characteristic>
              </characteristics>
            </profile>
          </profiles>
        </selection>
        
        <!-- ... more weapon selections ... -->
      </selections>
      
      <categories>
        <category id="8045-89a4..." name="Sergeant Model Sub-Type" entryId="8045-89a4-76d4-fcef" primary="false"/>
        <category id="594d-fa82..." name="Infantry Model Type" entryId="594d-fa82-13cb-a345" primary="false"/>
        <category id="1e7d-9066..." name="Heavy Model Sub-Type" entryId="1e7d-9066-28d2-97a0" primary="false"/>
      </categories>
    </selection>
    
    <!-- Legionaries - similar structure with profiles and rules -->
    <selection id="a19dd427..." name="Legionary" entryId="182a-8bcd-34d2-fbba::4aab-6f78-9ab5-3c0b" 
               number="9" type="model" from="entry">
      <!-- Rules and profiles for each model -->
      <!-- ... -->
    </selection>
    
    <!-- ✨ NEW: Boarding shields selection (REQUIRED, min=1) -->
    <selection id="omfnp4..." name="Boarding shield" entryId="182a-8bcd-34d2-fbba::09bc-9991-897b-b6f5::01e9-334c-80cb-f1c6" 
               number="1" type="upgrade" from="entry">
      <profiles>
        <profile id="d01b-15f1..." name="Boarding shield" typeId="5ec5-e0c3-1701-6f16" typeName="Wargear" from="entry">
          <characteristics>
            <characteristic name="Summary" typeId="8e7d-a0ae-fd85-983c">
              "Boarding shields grant a 5+ Invulnerable Save, the Shield Trait and the Heavy Sub-Type."
            </characteristic>
            <characteristic name="Description" typeId="9944-2f6d-d61b-03b5">
              A model with a boarding shield gains a 5+ Invulnerable Save. In addition it gains the Shield Trait and the Heavy Sub-Type.
            </characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selection>
    
    <!-- ✨ NEW: Frag grenades selection (REQUIRED, min=1) -->
    <selection id="ommfdr..." name="Frag grenades" entryId="182a-8bcd-34d2-fbba::1c84-3521-dfbb-c296::60e4-ca33-2e68-9afc" 
               number="1" type="upgrade" from="entry">
      <rules>
        <rule id="8687-05f8..." name="Blast (3&quot;)" hidden="false" page="294">
          <description>Attacks made with the Blast (X) Special Rule use a Blast Marker...</description>
        </rule>
      </rules>
      <profiles>
        <!-- Wargear profile -->
        <profile id="3035-fae8..." name="Frag grenades" typeId="5ec5-e0c3-1701-6f16" typeName="Wargear" from="entry">
          <characteristics>
            <characteristic name="Summary" typeId="8e7d-a0ae-fd85-983c">
              "Frag grenades can be used to make attacks during the Volley Step."
            </characteristic>
            <characteristic name="Description" typeId="9944-2f6d-d61b-03b5">
              When making Volley Attacks during Step 4 of the Charge Procedure...
            </characteristic>
          </characteristics>
        </profile>
        <!-- Ranged weapon profile -->
        <profile id="c4a9-24d0..." name="Frag grenades" typeId="c591-09ed-3e6f-eb2b" typeName="Ranged Weapon" from="entry">
          <characteristics>
            <characteristic name="R" typeId="cdb0-8654-6840-1037">6</characteristic>
            <characteristic name="FP" typeId="5037-1f27-1790-e355">1</characteristic>
            <characteristic name="RS" typeId="b9da-ee13-79f9-fa63">3</characteristic>
            <characteristic name="AP" typeId="7a23-0248-2b94-5951">6</characteristic>
            <characteristic name="D" typeId="88c3-1ca5-7dc1-f291">1</characteristic>
            <characteristic name="Special Rules" typeId="5aad-137a-8ee2-63fd">Blast (3&quot;)</characteristic>
            <characteristic name="Traits" typeId="1247-79d2-6cc1-8a03">Assault</characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selection>
    
    <!-- ✨ NEW: Krak grenades selection (REQUIRED, min=1) -->
    <selection id="ompq3n..." name="Krak grenades" entryId="182a-8bcd-34d2-fbba::06d0-09a8-652d-f497::fa20-82bc-c7de-9e97" 
               number="1" type="upgrade" from="entry">
      <rules>
        <rule id="7349-9e80..." name="Detonation" hidden="false" page="297">
          <description>Weapons with this Special Rule can only attack Vehicles and immobile Models...</description>
        </rule>
      </rules>
      <profiles>
        <!-- Melee weapon profile -->
        <profile id="18b8-b0a0..." name="Krak grenades" typeId="3587-6dcd-005c-c263" typeName="Melee Weapon" from="entry">
          <characteristics>
            <characteristic name="IM" typeId="6eec-4093-f946-1014">-3</characteristic>
            <characteristic name="AM" typeId="03d0-6094-84f0-e27e">1</characteristic>
            <characteristic name="SM" typeId="4505-de6f-d4ae-6280">6</characteristic>
            <characteristic name="AP" typeId="a014-126b-3b7b-27e8">4</characteristic>
            <characteristic name="D" typeId="6a9d-4feb-065a-33e7">2</characteristic>
            <characteristic name="Special Rules" typeId="ebe0-7b28-b40c-694e">Detonation</characteristic>
            <characteristic name="Traits" typeId="76e3-c188-bc65-3467">-</characteristic>
          </characteristics>
        </profile>
      </profiles>
    </selection>
  </selections>
  
  <costs>
    <cost name="Point(s)" typeId="9893-c379-920b-8982" value="32"/>
  </costs>
  
  <categories>
    <category id="157f-952c-13bb-41bf" name="Breacher Squad" entryId="157f-952c-13bb-41bf" primary="false"/>
    <category id="88e6-d373-4152-0dd8" entryId="88e6-d373-4152-0dd8" name="Troops" primary="true"/>
  </categories>
</selection>
```

## What's Different (Marked with ✨)

| Aspect | Pre (Current) | Post (Expected) |
|--------|---------------|-----------------|
| Unit rules | None | `<rule>` for Line (1), Shield trait, Shieldwall! reaction |
| Faction traits | None | `<profiles>` for Death Guard, Traitor |
| Model stats | None | Full `<profile>` with M, WS, BS, S, T, W, I, A, LD, CL, WP, IN, SAV, INV |
| Model rules | None | Infantry Type, Heavy Sub-Type, Sergeant Sub-Type rules |
| Weapon profiles | Missing | Complete weapon characteristics (R, FP, RS, AP, D) |
| Boarding shields | None | Required selection with wargear profile |
| Frag grenades | None | Required selection with both wargear + ranged weapon profiles |
| Krak grenades | None | Required selection with melee weapon profile |
| Rules attached | None | Each item has associated `<rules>` sections (Blast, Detonation, etc.) |

## The Pattern

**For EVERY unit being exported, add:**

1. **Unit-level `<rules>` section** 
   - Contains rules that apply to the whole unit
   - Examples: Line (X), role-specific abilities

2. **Unit-level `<profiles>` section**
   - Faction traits (always: Death Guard, Traitor, etc.)
   - Special unit traits (Shield for Breachers, etc.)
   - Special reactions (Shieldwall!, etc.)

3. **For each model:**
   - `<rules>` - Model type rules (Infantry Type, Heavy Sub-Type, Sergeant Sub-Type)
   - `<profiles>` - Full stat line (13 characteristics minimum)

4. **For each weapon/wargear:**
   - `<rules>` - Associated special rules
   - `<profiles>` - Wargear or Weapon profiles with characteristics
   - Multiple profiles if both wargear + weapon (grenades need both)

5. **Required wargear selections** (based on BSData constraints min="1")
   - Grenades for all infantry
   - Shields for heavy units
   - Specialized gear for officers
   - All with full profiles and rules attached

