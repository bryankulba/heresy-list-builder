/**
 * parse-cats.ts
 * Parses BattleScribe .gst/.cat XML files into clean JSON for the list builder.
 * Uses regex-based string parsing (not a DOM/SAX parser) because:
 *   - Files are multi-MB and the BattleScribe XML namespace adds noise
 *   - Consistent 4-space indentation makes boundary detection reliable
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WargearEntry {
  name: string;
  entryId: string; // entryLink id, used as selection entryId in .ros
}

export interface ModelEntry {
  name: string;
  entryId: string;
  cost: number;
  min: number;
  max: number;
  defaultWargear: WargearEntry[];
}

export interface UnitEntry {
  name: string;
  entryId: string;
  role: string;
  points: number;
  baseCost: number;
  /** All child model (or sub-unit) entries with their costs and counts */
  models: ModelEntry[];
  source: string;
}

export interface DetachmentSlot {
  role: string;
  min: number;
  max: number;
  prime: boolean;
  /** targetId of the categoryLink — used as the category entryId in .ros exports */
  categoryId: string;
}

export interface Detachment {
  name: string;
  entryId: string;
  type: 'core' | 'auxiliary' | 'apex' | 'other';
  slots: DetachmentSlot[];
  /** Faction keys that can field this detachment, e.g. ['death-guard', 'legiones-astartes'] */
  sources: string[];
}

export interface SystemInfo {
  gameSystemId: string;
  gameSystemName: string;
  revision: number;
  /** entryId of the top-level "Crusade Force Organization Chart" forceEntry in the .gst */
  forceOrgEntryId: string;
}

export interface CatalogueInfo {
  catalogueId: string;
  catalogueName: string;
  revision: number;
}

export interface ParseResult {
  units: Record<string, UnitEntry[]>;
  detachments: {
    core: Detachment[];
    auxiliary: Detachment[];
    apex: Detachment[];
    legion: Record<string, Detachment[]>;
  };
  system: SystemInfo;
  catalogues: Record<string, CatalogueInfo>;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// typeId for "Point(s)" cost in every BSData Heresy file
const POINTS_TYPE_ID = '9893-c379-920b-8982';

// ---------------------------------------------------------------------------
// extractRootAttrs
// ---------------------------------------------------------------------------
// Extracts the id, name, and revision from the root <catalogue> or <gameSystem>
// element. Used to capture BSData IDs needed for .ros export.

// Strips leading whitespace and optional roman numeral prefix from catalogue names.
// e.g. "                        XIV - Death Guard" → "Death Guard"
function normalizeCatalogueName(raw: string): string {
  return raw.trim().replace(/^[IVXLCDM]+\s*[-–]\s*/i, '');
}

function extractRootAttrs(xml: string): { id: string; name: string; revision: number } {
  const m = xml.match(/<(?:catalogue|gameSystem)\b([^>]*?)>/);
  if (!m) return { id: '', name: '', revision: 0 };
  const attrs = m[1];
  const id = attrs.match(/\bid="([^"]+)"/)?.[1] ?? '';
  const rawName = attrs.match(/\bname="([^"]+)"/)?.[1] ?? '';
  const rev = attrs.match(/\brevision="([^"]+)"/)?.[1];
  return { id, name: normalizeCatalogueName(rawName), revision: rev ? parseInt(rev, 10) : 0 };
}

// ---------------------------------------------------------------------------
// buildRoleMap
// ---------------------------------------------------------------------------
// The battlefield role for each unit is NOT stored on the sharedSelectionEntry
// itself. Instead, a root-level <entryLinks> block contains
// <entryLink type="selectionEntry" targetId="..."> elements, each with
// a <categoryLink primary="true" name="Troops"/> etc.
//
// The root-level block is identified by 2-space indentation ("\n  <entryLinks>").
// This avoids confusing it with nested <entryLinks> blocks inside
// <sharedSelectionEntryGroups>, which some catalogues (Solar Auxilia,
// Mechanicum) have between </sharedSelectionEntries> and the root block.
//
// Returns Map<unitId, roleName>.

interface RoleMaps {
  /** Maps sharedSelectionEntry id → battlefield role name */
  roleMap: Map<string, string>;
  /** Maps sharedSelectionEntry id → entryLink id (needed for .ros export) */
  linkIdMap: Map<string, string>;
}

function buildRoleMap(catalogueXml: string): RoleMaps {
  const roleMap = new Map<string, string>();
  const linkIdMap = new Map<string, string>();

  // Find the root-level <entryLinks> by its 2-space indentation signature
  const rootMarker = '\n  <entryLinks>';
  const markerIdx = catalogueXml.indexOf(rootMarker);
  if (markerIdx === -1) return { roleMap, linkIdMap };

  const elStart = markerIdx + 1; // skip the leading newline
  const elEnd = catalogueXml.indexOf('\n  </entryLinks>', elStart);
  if (elEnd === -1) return { roleMap, linkIdMap };

  const elSection = catalogueXml.slice(elStart, elEnd + '\n  </entryLinks>'.length);

  // Match each entryLink block. They look like:
  //   <entryLink ... targetId="abc" ...>...</entryLink>
  const linkPattern = /<entryLink\b([^>]*)>([\s\S]*?)<\/entryLink>/g;
  let m: RegExpExecArray | null;

  while ((m = linkPattern.exec(elSection)) !== null) {
    const attrs = m[1];
    const body = m[2];

    const targetMatch = attrs.match(/targetId="([^"]+)"/);
    if (!targetMatch) continue;
    const targetId = targetMatch[1];

    // The entryLink's own id is what the .ros file needs as the selection's entryId
    const linkIdMatch = attrs.match(/\bid="([^"]+)"/);
    if (linkIdMatch) linkIdMap.set(targetId, linkIdMatch[1]);

    // Find primary="true" categoryLink — attribute order varies
    const primaryMatch =
      body.match(/primary="true"[^/]*name="([^"]+)"/) ||
      body.match(/name="([^"]+)"[^/]*primary="true"/);
    if (primaryMatch) {
      roleMap.set(targetId, primaryMatch[1]);
    }
  }

  return { roleMap, linkIdMap };
}

// ---------------------------------------------------------------------------
// extractPointsBreakdown
// ---------------------------------------------------------------------------
// HH3 BSData cost structure (consistent 4-space indentation):
//
//   <selectionEntry type="unit" ...>        ← 4-space (in sharedSelectionEntries)
//     <costs>                               ← 6-space: UNIT BASE COST
//       <cost typeId="..." value="32"/>
//     </costs>
//     <selectionEntries>                    ← 6-space
//       <selectionEntry type="model" ...>  ← 8-space: MODEL ENTRIES
//         <entryLinks>
//           <entryLink ...>
//             <costs>                      ← 14-space: EQUIPMENT COSTS (ignored)
//         <costs>                          ← 10-space: MODEL OWN COST
//           <cost typeId="..." value="12"/>
//         <constraints>
//           <constraint type="min" value="9" field="selections" scope="parent"/>
//       </selectionEntry>
//     </selectionEntries>
//   </selectionEntry>
//
// Some single-model units put <costs> before <selectionEntries>.
// Equipment costs inside <entryLinks> appear at 14+ spaces — ignored.

// ---------------------------------------------------------------------------
// extractDefaultWargear
// ---------------------------------------------------------------------------
// Within a model selectionEntry's text, finds entryLinks that have an
// automatic="true" min constraint with value >= 1. These represent wargear
// that is always pre-selected (e.g. bolt pistol, bolter, chainsword).

function extractDefaultWargear(modelText: string): WargearEntry[] {
  const wargear: WargearEntry[] = [];
  const linkPattern = /<entryLink\b([^>]*)>([\s\S]*?)<\/entryLink>/g;
  let m: RegExpExecArray | null;

  while ((m = linkPattern.exec(modelText)) !== null) {
    const attrs = m[1];
    const body = m[2];

    // Look for a min constraint with value >= 1 and automatic="true" (attribute order varies)
    const autoMinMatch =
      body.match(/<constraint[^>]*type="min"[^>\/]*value="([1-9][^"]*)"[^>\/]*automatic="true"/) ||
      body.match(/<constraint[^>]*automatic="true"[^>\/]*type="min"[^>\/]*value="([1-9][^"]*)"/) ||
      body.match(/<constraint[^>]*value="([1-9][^"]*)"[^>\/]*type="min"[^>\/]*automatic="true"/);
    if (!autoMinMatch) continue;

    const nameMatch = attrs.match(/\bname="([^"]+)"/);
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    if (!nameMatch || !idMatch) continue;

    wargear.push({ name: nameMatch[1], entryId: idMatch[1] });
  }

  return wargear;
}

const COST_PATTERN = new RegExp(
  `typeId="${POINTS_TYPE_ID}"[^/]*value="(\\d+(?:\\.\\d+)?)"` +
  `|value="(\\d+(?:\\.\\d+)?)"[^/]*typeId="${POINTS_TYPE_ID}"`
);

interface PointsBreakdown {
  points: number;
  baseCost: number;
  models: ModelEntry[];
}


function extractPointsBreakdown(entryText: string): PointsBreakdown | null {
  // ── Unit-level base cost ─────────────────────────────────────────────────
  // Direct child <costs> at 6-space indentation (unit is at 4-space).
  const unitCostMatch = entryText.match(
    /\n {6}<costs>[\s\S]*?<cost\b[^>]*typeId="9893-c379-920b-8982"[^>]*value="(\d+(?:\.\d+)?)"[^/]*\/>/
  );
  const baseCost = unitCostMatch ? Math.round(parseFloat(unitCostMatch[1])) : 0;

  // ── Pattern 2 & 1: Direct model children at 8-space ──────────────────────
  const directModelPattern = /\n {8}<selectionEntry\b([^>]*)type="model"([^>]*)>/g;
  const directModelPositions: number[] = [];
  let mm: RegExpExecArray | null;
  while ((mm = directModelPattern.exec(entryText)) !== null) {
    directModelPositions.push(mm.index);
  }

  if (directModelPositions.length > 0) {
    const models: ModelEntry[] = [];
    let rawTotal = 0;

    for (let mi = 0; mi < directModelPositions.length; mi++) {
      const mStart = directModelPositions[mi];
      const mEnd = mi + 1 < directModelPositions.length
        ? directModelPositions[mi + 1]
        : entryText.length;
      const modelText = entryText.slice(mStart, mEnd);

      const openTag = modelText.slice(0, modelText.indexOf('>') + 1);
      const nameMatch = openTag.match(/\bname="([^"]+)"/);
      const mName = nameMatch ? nameMatch[1] : 'Unknown';
      const modelIdMatch = openTag.match(/\bid="([^"]+)"/);
      const modelId = modelIdMatch?.[1] ?? '';

      // Model cost at 10-space <costs>
      const modelCostMatch = modelText.match(
        /\n {10}<costs>[\s\S]*?<cost\b[^>]*typeId="9893-c379-920b-8982"[^>]*value="(\d+(?:\.\d+)?)"[^/]*\/>/
      );
      const cost = modelCostMatch ? parseFloat(modelCostMatch[1]) : 0;

      // Constraints at 12-space — attribute order varies
      const minMatch =
        modelText.match(/\n {12}<constraint[^>]*type="min"[^>]*value="(\d+)"[^>]*field="selections"[^>]*scope="parent"/) ??
        modelText.match(/\n {12}<constraint[^>]*field="selections"[^>]*scope="parent"[^>]*type="min"[^>]*value="(\d+)"/);
      const maxMatch =
        modelText.match(/\n {12}<constraint[^>]*type="max"[^>]*value="(\d+)"[^>]*field="selections"[^>]*scope="parent"/) ??
        modelText.match(/\n {12}<constraint[^>]*field="selections"[^>]*scope="parent"[^>]*type="max"[^>]*value="(\d+)"/);
      const min = minMatch ? parseInt(minMatch[1], 10) : 1;
      const max = maxMatch ? parseInt(maxMatch[1], 10) : min;

      const defaultWargear = extractDefaultWargear(modelText);
      rawTotal += cost * min;
      models.push({ name: mName, entryId: modelId, cost, min, max, defaultWargear });
    }

    const points = Math.round(baseCost + rawTotal);
    if (points === 0 && models.every(m => m.cost === 0)) return null;
    return { points, baseCost, models };
  }

  // ── Pattern 3: Sub-unit children at 8-space (e.g. Rapier Battery) ────────
  // These are selectionEntry type="unit" at 8-space — they represent crew groups
  // with their own costs and min/max constraints at 10/12-space.
  const subUnitPattern = /\n {8}<selectionEntry\b([^>]*)type="unit"([^>]*)>/g;
  const subUnitPositions: number[] = [];
  while ((mm = subUnitPattern.exec(entryText)) !== null) {
    subUnitPositions.push(mm.index);
  }

  if (subUnitPositions.length > 0) {
    const models: ModelEntry[] = [];
    let rawTotal = 0;

    for (let si = 0; si < subUnitPositions.length; si++) {
      const sStart = subUnitPositions[si];
      const sEnd = si + 1 < subUnitPositions.length
        ? subUnitPositions[si + 1]
        : entryText.length;
      const subText = entryText.slice(sStart, sEnd);

      const subOpenTag = subText.slice(0, subText.indexOf('>') + 1);
      const nameMatch = subOpenTag.match(/\bname="([^"]+)"/);
      const sName = nameMatch ? nameMatch[1] : 'Unknown';
      const subIdMatch = subOpenTag.match(/\bid="([^"]+)"/);
      const subId = subIdMatch?.[1] ?? '';

      // Sub-unit cost at 10-space <costs>
      const subCostMatch = subText.match(
        /\n {10}<costs>[\s\S]*?<cost\b[^>]*typeId="9893-c379-920b-8982"[^>]*value="(\d+(?:\.\d+)?)"[^/]*\/>/
      );
      const cost = subCostMatch ? parseFloat(subCostMatch[1]) : 0;

      // Constraints at 12-space
      const minMatch =
        subText.match(/\n {12}<constraint[^>]*type="min"[^>]*value="(\d+)"[^>]*field="selections"[^>]*scope="parent"/) ??
        subText.match(/\n {12}<constraint[^>]*field="selections"[^>]*scope="parent"[^>]*type="min"[^>]*value="(\d+)"/);
      const maxMatch =
        subText.match(/\n {12}<constraint[^>]*type="max"[^>]*value="(\d+)"[^>]*field="selections"[^>]*scope="parent"/) ??
        subText.match(/\n {12}<constraint[^>]*field="selections"[^>]*scope="parent"[^>]*type="max"[^>]*value="(\d+)"/);
      const min = minMatch ? parseInt(minMatch[1], 10) : 1;
      const max = maxMatch ? parseInt(maxMatch[1], 10) : min;

      // Skip variant/hidden sub-units: those with min=0 are optional extras
      if (min === 0) continue;

      rawTotal += cost * min;
      models.push({ name: sName, entryId: subId, cost, min, max, defaultWargear: [] });
    }

    const points = Math.round(baseCost + rawTotal);
    if (points > 0 || baseCost > 0) {
      return { points, baseCost, models };
    }
  }

  // ── Fallback: single-model unit with cost on the unit itself ──────────────
  if (baseCost > 0) {
    return { points: baseCost, baseCost, models: [] };
  }

  return null;
}

// ---------------------------------------------------------------------------
// normalizeRole
// ---------------------------------------------------------------------------
// Strips qualifiers like "Command - Centurions Only" → "Command".
// Splits on " - " (with spaces) so hyphenated role names like "Heavy Assault"
// and "War-engine" are not affected.

function normalizeRole(role: string): string {
  const idx = role.indexOf(' - ');
  return idx !== -1 ? role.slice(0, idx) : role;
}

// ---------------------------------------------------------------------------
// extractUnitsFromCatalogue
// ---------------------------------------------------------------------------
// Pulls all top-level sharedSelectionEntry elements of type="unit".
// "Top-level" is identified by 4-space indentation inside the
// <sharedSelectionEntries> block — nested sub-entries use deeper indentation.

function extractUnitsFromCatalogue(
  xml: string,
  roleMap: Map<string, string>,
  linkIdMap: Map<string, string>,
  source: string,
  warnings: string[]
): UnitEntry[] {
  const sharedStart = xml.indexOf('<sharedSelectionEntries>');
  const sharedEnd = xml.indexOf('</sharedSelectionEntries>');
  if (sharedStart === -1 || sharedEnd === -1) return [];

  const section = xml.slice(sharedStart, sharedEnd);

  // Find all top-level selectionEntry elements.
  // Top-level = exactly 4 spaces of indentation inside the <sharedSelectionEntries> block.
  // Attribute order varies between entries, so handle both orderings.
  const topPattern =
    /\n {4}<selectionEntry\b([^>]*)>/g;

  const positions: Array<{ start: number; id: string; name: string; isUnit: boolean }> = [];
  let m: RegExpExecArray | null;

  while ((m = topPattern.exec(section)) !== null) {
    const attrs = m[1];
    const typeMatch = attrs.match(/\btype="([^"]+)"/);
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    const nameMatch = attrs.match(/\bname="([^"]+)"/);
    if (!idMatch || !nameMatch) continue;

    positions.push({
      start: m.index,
      id: idMatch[1],
      name: nameMatch[1],
      isUnit: typeMatch?.[1] === 'unit',
    });
  }

  const units: UnitEntry[] = [];

  for (let i = 0; i < positions.length; i++) {
    const { start, id, name, isUnit } = positions[i];
    if (!isUnit) continue;

    const end = i + 1 < positions.length ? positions[i + 1].start : section.length;
    const entryText = section.slice(start, end);

    const role = roleMap.get(id);
    if (!role) {
      // No role assignment = internal sub-entry or non-force-org unit; skip silently
      // (true hidden sub-entries like Rapier Crew sub-unit, etc.)
      continue;
    }

    const breakdown = extractPointsBreakdown(entryText);
    if (breakdown === null) {
      warnings.push(`${source}: No points found for "${name}" (id=${id})`);
    }

    units.push({
      name,
      entryId: linkIdMap.get(id) ?? id,
      role: normalizeRole(role),
      points: breakdown?.points ?? 0,
      baseCost: breakdown?.baseCost ?? 0,
      models: breakdown?.models ?? [],
      source,
    });
  }

  return units;
}

// ---------------------------------------------------------------------------
// extractSlots
// ---------------------------------------------------------------------------
// Given the body text of a forceEntry element, extracts its slot definitions
// from the immediate <categoryLinks> block (stops before any nested <forceEntries>).

function extractSlots(forceEntryBody: string): DetachmentSlot[] {
  const slots: DetachmentSlot[] = [];

  // Only look at the categoryLinks before any nested forceEntries
  const nestedStart = forceEntryBody.indexOf('<forceEntries>');
  const searchArea =
    nestedStart === -1 ? forceEntryBody : forceEntryBody.slice(0, nestedStart);

  const catLinkPattern =
    /<categoryLink\b([^>]*)>([\s\S]*?)<\/categoryLink>/g;
  let m: RegExpExecArray | null;

  while ((m = catLinkPattern.exec(searchArea)) !== null) {
    const linkAttrs = m[1];
    const body = m[2];

    const nameMatch = linkAttrs.match(/\bname="([^"]+)"/);
    if (!nameMatch) continue;
    const roleName = nameMatch[1];

    const targetIdMatch = linkAttrs.match(/\btargetId="([^"]+)"/);
    const categoryId = targetIdMatch?.[1] ?? '';

    const minMatch = body.match(/type="min"[^/]*value="(\d+)"/);
    const maxMatch = body.match(/type="max"[^/]*value="(\d+)"/);

    const maxVal = maxMatch ? parseInt(maxMatch[1], 10) : 0;
    if (maxVal === 0) continue; // Skip placeholder / zero-max slots

    slots.push({
      role: roleName,
      min: minMatch ? parseInt(minMatch[1], 10) : 0,
      max: maxVal,
      prime: roleName.toLowerCase().startsWith('prime'),
      categoryId,
    });
  }

  return slots;
}

// ---------------------------------------------------------------------------
// extractFactionSources
// ---------------------------------------------------------------------------
// Parses the forceEntry body text for the <modifier type="set" value="false"
// field="hidden"> block and returns the faction keys derived from <comment>
// tags embedded in the conditionGroups.

const FACTION_COMMENT_MAP: Record<string, string> = {
  'DG': 'death-guard',
  'DG Only': 'death-guard',
  'DA': 'dark-angels',
  'EC': 'emperors-children',
  'IW': 'iron-warriors',
  'WS': 'white-scars',
  'SW': 'space-wolves',
  'IF': 'imperial-fists',
  'NL': 'night-lords',
  'BA': 'blood-angels',
  'IH': 'iron-hands',
  'WE': 'world-eaters',
  'UM': 'ultramarines',
  'TS': 'thousand-sons',
  'SH': 'sons-of-horus',
  'WB': 'word-bearers',
  'SL': 'shattered-legions',
  'Shattered Legions': 'shattered-legions',
  'RG': 'raven-guard',
  'AL': 'alpha-legion',
  'Auxilia': 'solar-auxilia',
  'Solar Auxilia': 'solar-auxilia',
  'SA Only': 'solar-auxilia',
  'Night Lords': 'night-lords',
  'World Eaters': 'world-eaters',
  'Space Wolves': 'space-wolves',
  'Iron Hands': 'iron-hands',
  'SoH': 'sons-of-horus',
  'Custodes': 'talons-of-the-emperor',
  'Custodes only': 'talons-of-the-emperor',
  'Mechanicum': 'mechanicum',
  'Talons': 'talons-of-the-emperor',
  'Sisters': 'sisters-of-silence',
  'Daemons': 'daemons',
  'Militia': 'militia',
  'Blackshields': 'blackshields',
  'Skitarii': 'skitarii',
  'SAL': 'salamanders',
};

function extractFactionSources(body: string): string[] {
  const sources = new Set<string>();

  // Search for the forceEntry-level unhide modifier (type="set" value="false" field="hidden").
  // There can be multiple modifiers with the same type/value/field — some at the
  // categoryLink level (no comments) and one at the forceEntry level (has <comment> tags
  // with faction abbreviations like "DG", "DA", etc.). We want the one with comments.
  const modPattern = /<modifier\b([^>]*)>([\s\S]*?)<\/modifier>/g;
  let m: RegExpExecArray | null;

  while ((m = modPattern.exec(body)) !== null) {
    const attrs = m[1];
    const inner = m[2];

    if (
      attrs.includes('type="set"') &&
      attrs.includes('value="false"') &&
      attrs.includes('field="hidden"') &&
      inner.includes('<comment>')
    ) {
      // This is the forceEntry-level modifier — extract faction comments
      const commentPattern = /<comment>([^<]+)<\/comment>/g;
      let cm: RegExpExecArray | null;
      while ((cm = commentPattern.exec(inner)) !== null) {
        const text = cm[1].trim();
        const faction = FACTION_COMMENT_MAP[text];
        if (faction) sources.add(faction);
      }
      break;
    }
  }

  return Array.from(sources).sort();
}

// ---------------------------------------------------------------------------
// parseDetachments
// ---------------------------------------------------------------------------
// Extracts detachment definitions from the .gst forceEntries section.

function parseDetachments(gstXml: string): { detachments: ParseResult['detachments']; forceOrgEntryId: string } {
  const detachments: ParseResult['detachments'] = {
    core: [],
    auxiliary: [],
    apex: [],
    legion: {},
  };
  let forceOrgEntryId = '';

  const feStart = gstXml.indexOf('<forceEntries>');
  if (feStart === -1) return { detachments, forceOrgEntryId };

  const feEnd = gstXml.indexOf('</forceEntries>', feStart);
  const feSection = gstXml.slice(feStart, feEnd + '</forceEntries>'.length);

  // Find all forceEntry open tags and their positions
  const forcePattern = /<forceEntry\b([^>]*)>/g;
  const entries: Array<{ start: number; name: string; id: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = forcePattern.exec(feSection)) !== null) {
    const nameMatch = m[1].match(/\bname="([^"]+)"/);
    if (!nameMatch) continue;
    const idMatch = m[1].match(/\bid="([^"]+)"/);
    entries.push({ start: m.index, name: nameMatch[1], id: idMatch?.[1] ?? '' });
  }

  for (let i = 0; i < entries.length; i++) {
    const { start, name, id } = entries[i];

    // Capture the top-level org chart entry ID, then skip root wrappers
    if (name === 'Crusade Force Organization Chart') { forceOrgEntryId = id; continue; }
    if (name === 'Crusade Forces') continue;

    const end = i + 1 < entries.length ? entries[i + 1].start : feSection.length;
    const body = feSection.slice(start, end);

    const slots = extractSlots(body);
    if (slots.length === 0) continue;

    let type: Detachment['type'] = 'other';
    if (name === 'Crusade Primary Detachment' || name === 'Warlord Detachment') {
      type = 'core';
    } else if (name.startsWith('Auxiliary - ') || name.startsWith('Auxiliary – ')) {
      type = 'auxiliary';
    } else if (name.startsWith('Apex - ') || name.startsWith('Apex – ')) {
      type = 'apex';
    }

    const sources = extractFactionSources(body);
    const detachment: Detachment = { name, entryId: id, type, slots, sources };
    detachments[type === 'other' ? 'auxiliary' : type].push(detachment);
  }

  return { detachments, forceOrgEntryId };
}

// ---------------------------------------------------------------------------
// parseAll — main exported entry point
// ---------------------------------------------------------------------------

export function parseAll(
  gstXml: string,
  laXml: string,
  factionCats: Record<string, string>
): ParseResult {
  const warnings: string[] = [];

  const { roleMap: laRoleMap, linkIdMap: laLinkIdMap } = buildRoleMap(laXml);
  const laUnits = extractUnitsFromCatalogue(laXml, laRoleMap, laLinkIdMap, 'legiones-astartes', warnings);

  const units: Record<string, UnitEntry[]> = { 'legiones-astartes': laUnits };
  for (const [factionKey, xml] of Object.entries(factionCats)) {
    const { roleMap, linkIdMap } = buildRoleMap(xml);
    units[factionKey] = extractUnitsFromCatalogue(xml, roleMap, linkIdMap, factionKey, warnings);
  }

  const { detachments, forceOrgEntryId } = parseDetachments(gstXml);

  const gstAttrs = extractRootAttrs(gstXml);
  const system: SystemInfo = {
    gameSystemId: gstAttrs.id,
    gameSystemName: gstAttrs.name,
    revision: gstAttrs.revision,
    forceOrgEntryId,
  };

  const laAttrs = extractRootAttrs(laXml);
  const catalogues: Record<string, CatalogueInfo> = {
    'legiones-astartes': {
      catalogueId: laAttrs.id,
      catalogueName: laAttrs.name,
      revision: laAttrs.revision,
    },
  };
  for (const [factionKey, xml] of Object.entries(factionCats)) {
    const a = extractRootAttrs(xml);
    catalogues[factionKey] = { catalogueId: a.id, catalogueName: a.name, revision: a.revision };
  }

  return { units, detachments, system, catalogues, warnings };
}
