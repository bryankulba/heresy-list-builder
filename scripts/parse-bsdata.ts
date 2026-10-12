/**
 * parse-bsdata.ts
 * Parses BSData Horus Heresy 3rd Edition JSON files (.json, the format BSData
 * migrated to on 2026-07-14) into the compact JSON the list builder consumes.
 *
 * The BSData JSON is the BattleScribe schema expressed as objects: a root
 * `gameSystem` or `catalogue` with arrays such as `forceEntries`,
 * `sharedSelectionEntries`, `entryLinks`, `categoryLinks`, `constraints`,
 * `modifiers`, `costs`. Output shape is unchanged from the old XML parser so
 * the app keeps working; see src/data/loader.ts.
 */

// ---------------------------------------------------------------------------
// Raw BSData JSON types (only the fields we read)
// ---------------------------------------------------------------------------

export interface BsConstraint {
  id?: string;
  type: string; // 'min' | 'max'
  value: number;
  field: string;
  scope: string;
  automatic?: boolean;
}

export interface BsCondition {
  type: string;
  value: number;
  field: string;
  scope: string;
  childId?: string;
}

export interface BsConditionGroup {
  type: string;
  conditions?: BsCondition[];
  conditionGroups?: BsConditionGroup[];
  comment?: string;
}

export interface BsModifier {
  type: string;
  field: string;
  value: string | number | boolean;
  conditions?: BsCondition[];
  conditionGroups?: BsConditionGroup[];
  comment?: string;
}

export interface BsModifierGroup {
  modifiers?: BsModifier[];
  modifierGroups?: BsModifierGroup[];
  conditions?: BsCondition[];
  conditionGroups?: BsConditionGroup[];
}

export interface BsCost {
  name: string;
  typeId: string;
  value: number;
}

export interface BsCategoryLink {
  id: string;
  name: string;
  targetId: string;
  primary?: boolean;
  constraints?: BsConstraint[];
  modifiers?: BsModifier[];
}

/** selectionEntry, selectionEntryGroup and entryLink share most fields. */
export interface BsEntry {
  id: string;
  name: string;
  type?: string; // selectionEntry: 'unit' | 'model' | 'upgrade'; entryLink: 'selectionEntry' | 'selectionEntryGroup'
  hidden?: boolean;
  targetId?: string;
  defaultSelectionEntryId?: string;
  flatten?: boolean;
  costs?: BsCost[];
  constraints?: BsConstraint[];
  modifiers?: BsModifier[];
  modifierGroups?: BsModifierGroup[];
  categoryLinks?: BsCategoryLink[];
  selectionEntries?: BsEntry[];
  selectionEntryGroups?: BsEntry[];
  entryLinks?: BsEntry[];
  rules?: BsRule[];
  infoLinks?: Array<{ id: string; name: string; targetId: string; type: string }>;
}

export interface BsRule {
  id: string;
  name: string;
  description?: string;
}

export interface BsForceEntry {
  id: string;
  name: string;
  hidden?: boolean;
  categoryLinks?: BsCategoryLink[];
  modifiers?: BsModifier[];
  modifierGroups?: BsModifierGroup[];
  forceEntries?: BsForceEntry[];
}

export interface BsCategoryEntry {
  id: string;
  name: string;
}

interface BsRoot {
  id: string;
  name: string;
  revision: number;
  library?: boolean;
  categoryEntries?: BsCategoryEntry[];
  forceEntries?: BsForceEntry[];
  entryLinks?: BsEntry[];
  sharedSelectionEntries?: BsEntry[];
  sharedSelectionEntryGroups?: BsEntry[];
  sharedRules?: BsRule[];
}

export interface BsGameSystemFile {
  gameSystem: BsRoot;
}

export interface BsCatalogueFile {
  catalogue: BsRoot;
}

// ---------------------------------------------------------------------------
// Output types (consumed by src/data/loader.ts — keep in sync with src/types)
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
  /** Full primary category incl. any qualifier, e.g. "Support - Castellax Battle Maniple Only" */
  primaryCategory: string;
  points: number;
  baseCost: number;
  /** All child model (or sub-unit) entries with their costs and counts */
  models: ModelEntry[];
  source: string;
  /** Mandatory unit-level wargear (grenades, boarding shields, etc.) */
  unitWargear?: WargearEntry[];
  /** Number of auxiliary detachments this unit unlocks when placed in a Command slot (default 1). Derived from BSData "Officer of the Line (N)" category. */
  officerOfTheLine?: number;
  /**
   * Entry and category ids the unit contains at its default composition, with
   * counts (models count per model). Lets the app evaluate BSData conditions
   * such as "atLeast unit Unique Model Sub-Type".
   */
  facts: Record<string, number>;
  /** How the unit links its Prime benefits: the "Prime Unit" link and the benefit group(s) inside it */
  prime?: { linkId: string; groups: string[] };
}

// ---------------------------------------------------------------------------
// Rules data: BSData conditions/modifiers kept (slimmed) for the app's evaluator
// ---------------------------------------------------------------------------

export interface RuleCondition {
  type: string;   // instanceOf, notInstanceOf, atLeast, greaterThan, lessThan, atMost, equalTo, notEqualTo
  scope: string;  // self, parent, unit, ancestor, force, roster, primary-catalogue…
  field: string;  // selections, forces, or a cost/limit field
  value: number;
  childId?: string;
}

export interface RuleConditionGroup {
  type: string; // and | or
  conditions?: RuleCondition[];
  conditionGroups?: RuleConditionGroup[];
}

export interface RuleModifier {
  type: string;  // set, increment, decrement, add, remove, set-primary…
  field: string; // hidden, category, or a constraint id
  value: string | number | boolean;
  conditions?: RuleCondition[];
  conditionGroups?: RuleConditionGroup[];
}

/** A node in a Prime benefit tree: a group of choices or a choosable benefit. */
export interface PrimeNode {
  /** Id used for the selection's entryId in a .ros (the entry link id where linked) */
  id: string;
  name: string;
  kind: 'group' | 'option';
  hidden?: boolean;
  /** Modifiers that can change visibility (field "hidden") */
  modifiers?: RuleModifier[];
  description?: string;
  children?: PrimeNode[];
}

export interface RulesData {
  /** Prime benefit trees, keyed by the shared group id units link to */
  primeGroups: Record<string, PrimeNode>;
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
  type: 'core' | 'auxiliary' | 'apex' | 'allied' | 'additional' | 'other';
  slots: DetachmentSlot[];
  /** Faction keys whose primary catalogue can field this detachment (empty = all) */
  sources: string[];
}

/**
 * A root force entry ("force org chart") and the detachments (child forces) it
 * can contain. In a .ros roster each army is one root <force> with one child
 * <force> per detachment.
 */
export interface ForceChart {
  id: string;
  name: string;
  /** Faction key of the catalogue that defines the chart; null for game-system charts */
  catalogue: string | null;
  detachments: Detachment[];
}

export interface SystemInfo {
  gameSystemId: string;
  gameSystemName: string;
  revision: number;
  /** entryId of the top-level "Crusade Force Organization Chart" forceEntry */
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
    /** Every supported force org chart (Crusade, Allied Detachment, Knight Households…) */
    charts: ForceChart[];
  };
  system: SystemInfo;
  catalogues: Record<string, CatalogueInfo>;
  rules: RulesData;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants & small helpers
// ---------------------------------------------------------------------------

// typeId for "Point(s)" cost in every BSData Heresy file
const POINTS_TYPE_ID = '9893-c379-920b-8982';

const CRUSADE_FORCE_ORG_NAME = 'Crusade Force Organization Chart';

// Shared groups whose choice is driven by the force org, not by the unit: the
// .ros export emits these from the roster's actual unlocks (see buildRos.ts).
const FORCE_ORG_CHOICE_GROUP_IDS = new Set([
  '969e-8b5b-1410-cfc6', // High Command Detachment Choice → One Apex / One Auxiliary Detachment
]);

/** "                        XIV - Death Guard" → "Death Guard" */
export function normalizeCatalogueName(raw: string): string {
  return raw.trim().replace(/^[IVXLCDM]+\s*[-–]\s*/i, '');
}

/** Catalogue name → faction key: "Emperor's Children" → "emperors-children" */
export function factionKeyForCatalogue(rawName: string): string {
  return normalizeCatalogueName(rawName)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Strips qualifiers like "Command - Centurions Only" → "Command" (keeps "Heavy Assault", "War-engine"). */
function normalizeRole(role: string): string {
  const idx = role.indexOf(' - ');
  return idx !== -1 ? role.slice(0, idx) : role;
}

function pointsOf(entry: { costs?: BsCost[] }): number {
  return entry.costs?.find((c) => c.typeId === POINTS_TYPE_ID)?.value ?? 0;
}

function selectionConstraint(entry: BsEntry, type: 'min' | 'max'): number | undefined {
  return entry.constraints?.find(
    (c) => c.type === type && c.field === 'selections' && c.scope === 'parent'
  )?.value;
}

/** Depth-first walk over every object in a subtree. */
function walk(node: unknown, visit: (obj: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
  } else if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>);
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') walk(value, visit);
    }
  }
}

function allConditions(holder: { conditions?: BsCondition[]; conditionGroups?: BsConditionGroup[] }): BsCondition[] {
  const out = [...(holder.conditions ?? [])];
  for (const group of holder.conditionGroups ?? []) out.push(...allConditions(group));
  return out;
}

/**
 * Every modifier on a holder, including those inside modifierGroups. A group's
 * conditions apply to all of its modifiers, so they are folded into each
 * returned modifier as an extra 'and' condition group.
 */
function allModifiers(holder: { modifiers?: BsModifier[]; modifierGroups?: BsModifierGroup[] }): BsModifier[] {
  const out = [...(holder.modifiers ?? [])];
  for (const group of holder.modifierGroups ?? []) {
    const groupConditions: BsConditionGroup = {
      type: 'and',
      conditions: group.conditions,
      conditionGroups: group.conditionGroups,
    };
    const hasGroupConditions = allConditions(groupConditions).length > 0;
    for (const mod of allModifiers(group)) {
      out.push(
        hasGroupConditions
          ? { ...mod, conditionGroups: [...(mod.conditionGroups ?? []), groupConditions] }
          : mod
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mandatory & default wargear
// ---------------------------------------------------------------------------

function hasMinAtLeastOne(entry: BsEntry): boolean {
  return entry.constraints?.some((c) => c.type === 'min' && c.value >= 1) ?? false;
}

/** max 0 with no modifiers that could raise it. */
function isDisabled(entry: BsEntry): boolean {
  const maxZero = entry.constraints?.some((c) => c.type === 'max' && c.field === 'selections' && c.value === 0) ?? false;
  return maxZero && allModifiers(entry).length === 0;
}

/** Shared entries and groups by id, across the game system and every catalogue. */
export type SharedIndex = Map<string, BsEntry>;

export function buildSharedIndex(roots: BsRoot[]): SharedIndex {
  const index: SharedIndex = new Map();
  for (const root of roots) {
    for (const e of [...(root.sharedSelectionEntries ?? []), ...(root.sharedSelectionEntryGroups ?? [])]) {
      if (!index.has(e.id)) index.set(e.id, e);
    }
  }
  return index;
}

/**
 * Resolves an entryLink to a selectionEntryGroup into the group it targets,
 * with the link's own overrides (id, name, hidden, constraints, default) applied.
 */
function resolveGroupLink(link: BsEntry, index: SharedIndex): BsEntry | undefined {
  const target = link.targetId ? index.get(link.targetId) : undefined;
  if (!target) return undefined;
  return {
    ...target,
    id: link.id,
    name: link.name,
    hidden: Boolean(link.hidden || target.hidden),
    constraints: link.constraints ?? target.constraints,
    modifiers: [...(link.modifiers ?? []), ...(target.modifiers ?? [])],
    defaultSelectionEntryId: link.defaultSelectionEntryId ?? target.defaultSelectionEntryId,
  };
}

/**
 * Wargear a unit or model always carries when first added, i.e. what BattleScribe
 * / New Recruit pre-select:
 *  - selections with a min≥1 constraint (grenades, a sergeant's bolt pistol, a
 *    vehicle's hull weapon, a primarch's mandatory upgrades…)
 *  - the default choice of each selectionEntryGroup (sponsons, a squad's special
 *    weapon, Melee / Pistol choices…), following links into shared groups
 *
 * Walks the node's options without crossing into child models or sub-units
 * (those carry their own wargear) and skips hidden or disabled options. Groups
 * themselves are never emitted — only concrete selections.
 */
function collectMandatoryWargear(node: BsEntry, index: SharedIndex): WargearEntry[] {
  const wargear: WargearEntry[] = [];
  const add = (e: BsEntry) => {
    if (!wargear.some((w) => w.entryId === e.id)) wargear.push({ name: e.name, entryId: e.id });
  };
  const isGroupLink = (e: BsEntry) => e.type === 'selectionEntryGroup';

  const visit = (container: BsEntry, depth: number) => {
    if (depth > 8) return; // guard against link cycles

    const options = [...(container.entryLinks ?? []), ...(container.selectionEntries ?? [])].filter(
      (e) => !e.hidden && e.type !== 'model' && e.type !== 'unit' && !isGroupLink(e)
    );
    for (const option of options) {
      if (hasMinAtLeastOne(option) && !isDisabled(option)) add(option);
    }

    const groups = [
      ...(container.selectionEntryGroups ?? []),
      ...(container.entryLinks ?? [])
        .filter((link) => isGroupLink(link) && !FORCE_ORG_CHOICE_GROUP_IDS.has(link.targetId ?? ''))
        .map((link) => resolveGroupLink(link, index))
        .filter((g): g is BsEntry => g !== undefined),
    ];
    for (const group of groups) {
      if (group.hidden || isDisabled(group)) continue;
      const defaultId = group.defaultSelectionEntryId;
      if (defaultId) {
        const choice = [...(group.entryLinks ?? []), ...(group.selectionEntries ?? [])].find((e) => e.id === defaultId);
        if (choice && !isGroupLink(choice)) add(choice);
      }
      visit(group, depth + 1);
    }
  };

  visit(node, 0);
  return wargear;
}

// ---------------------------------------------------------------------------
// Conditions, unit facts and Prime benefits
// ---------------------------------------------------------------------------

function slimConditions(holder: { conditions?: BsCondition[]; conditionGroups?: BsConditionGroup[] }) {
  const out: { conditions?: RuleCondition[]; conditionGroups?: RuleConditionGroup[] } = {};
  if (holder.conditions?.length) {
    out.conditions = holder.conditions.map((c) => ({
      type: c.type,
      scope: c.scope,
      field: c.field,
      value: c.value,
      ...(c.childId ? { childId: c.childId } : {}),
    }));
  }
  if (holder.conditionGroups?.length) {
    out.conditionGroups = holder.conditionGroups.map((g) => ({ type: g.type, ...slimConditions(g) }));
  }
  return out;
}

export function slimModifier(m: BsModifier): RuleModifier {
  return { type: m.type, field: m.field, value: m.value, ...slimConditions(m) };
}

/** Entry/category ids a unit contains at default composition, with counts. */
function unitFacts(unit: BsEntry, rootLink: BsEntry, models: ModelEntry[]): Record<string, number> {
  const facts: Record<string, number> = {};
  const add = (id: string | undefined, n: number) => {
    if (id && n > 0) facts[id] = (facts[id] ?? 0) + n;
  };
  add(unit.id, 1);
  add(rootLink.id, 1);
  for (const c of [...(unit.categoryLinks ?? []), ...(rootLink.categoryLinks ?? [])]) add(c.targetId, 1);
  const modelDefs = new Map(
    [...(unit.selectionEntries ?? []), ...(unit.selectionEntryGroups ?? []).flatMap((g) => g.selectionEntries ?? [])].map(
      (e) => [e.id, e]
    )
  );
  for (const m of models) {
    add(m.entryId, m.min);
    for (const c of modelDefs.get(m.entryId)?.categoryLinks ?? []) add(c.targetId, m.min);
    for (const w of m.defaultWargear) add(w.entryId, m.min);
  }
  return facts;
}

/** The game system's shared "Prime Unit" upgrade that every prime-capable unit links. */
const PRIME_UNIT_NAME = 'Prime Unit';

function primeLinkage(unit: BsEntry): UnitEntry['prime'] {
  const link = (unit.entryLinks ?? []).find((l) => l.name === PRIME_UNIT_NAME && l.targetId);
  if (!link) return undefined;
  const groups = (link.entryLinks ?? [])
    .filter((l) => l.type === 'selectionEntryGroup' && l.targetId)
    .map((l) => l.targetId as string);
  return groups.length > 0 ? { linkId: link.id, groups } : undefined;
}

function describe(entry: BsEntry, rules: Map<string, BsRule>): string | undefined {
  const inline = (entry.rules ?? []).map((r) => r.description?.trim()).filter(Boolean);
  if (inline.length > 0) return inline.join('\n\n');
  const linked = (entry.infoLinks ?? [])
    .filter((l) => l.type === 'rule')
    .map((l) => {
      const rule = rules.get(l.targetId);
      return rule?.description ? `${l.name}: ${rule.description.trim()}` : undefined;
    })
    .filter(Boolean);
  return linked.length > 0 ? linked.join('\n\n') : undefined;
}

/** Builds a Prime benefit tree node, following entry links into shared entries/groups. */
function buildPrimeNode(entry: BsEntry, index: SharedIndex, rules: Map<string, BsRule>, depth = 0): PrimeNode {
  const target = entry.targetId ? index.get(entry.targetId) : undefined;
  const node: BsEntry = target
    ? { ...target, id: entry.id, name: entry.name, hidden: Boolean(entry.hidden || target.hidden),
        modifiers: [...(entry.modifiers ?? []), ...(target.modifiers ?? [])],
        modifierGroups: [...(entry.modifierGroups ?? []), ...(target.modifierGroups ?? [])] }
    : entry;
  const isGroup = entry.type === 'selectionEntryGroup' || (!entry.type && !entry.targetId);
  const hiddenMods = allModifiers(node).filter((m) => m.field === 'hidden').map(slimModifier);
  const children =
    depth < 6
      ? [...(node.selectionEntries ?? []), ...(node.selectionEntryGroups ?? []), ...(node.entryLinks ?? [])].map((c) =>
          buildPrimeNode(c, index, rules, depth + 1)
        )
      : [];
  const description = isGroup ? undefined : describe(target ?? entry, rules);
  return {
    id: node.id,
    name: node.name.trim(),
    kind: isGroup ? 'group' : 'option',
    ...(node.hidden ? { hidden: true } : {}),
    ...(hiddenMods.length > 0 ? { modifiers: hiddenMods } : {}),
    ...(description ? { description } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

interface PointsBreakdown {
  points: number;
  baseCost: number;
  models: ModelEntry[];
}

function extractPointsBreakdown(unit: BsEntry, index: SharedIndex): PointsBreakdown | null {
  const baseCost = Math.round(pointsOf(unit));
  const children = unit.selectionEntries ?? [];

  // Models: cost × minimum count. A few units (e.g. Caladius Grav-Tank) keep
  // their model variants in a choice group instead; take the group's default.
  let modelEntries = children.filter((e) => e.type === 'model');
  if (modelEntries.length === 0) {
    for (const group of unit.selectionEntryGroups ?? []) {
      const variants = (group.selectionEntries ?? []).filter((e) => e.type === 'model');
      if (variants.length === 0 || !hasMinAtLeastOne(group)) continue;
      const chosen = variants.find((e) => e.id === group.defaultSelectionEntryId) ?? variants[0];
      const min = Math.max(1, selectionConstraint(chosen, 'min') ?? 1);
      modelEntries.push({
        ...chosen,
        constraints: [
          { type: 'min', value: min, field: 'selections', scope: 'parent' },
          { type: 'max', value: Math.max(min, selectionConstraint(chosen, 'max') ?? min), field: 'selections', scope: 'parent' },
        ],
      });
    }
  }
  if (modelEntries.length > 0) {
    let rawTotal = 0;
    const models = modelEntries.map((m): ModelEntry => {
      const cost = pointsOf(m);
      const min = selectionConstraint(m, 'min') ?? 1;
      const max = selectionConstraint(m, 'max') ?? min;
      rawTotal += cost * min;
      return { name: m.name, entryId: m.id, cost, min, max, defaultWargear: collectMandatoryWargear(m, index) };
    });
    const points = Math.round(baseCost + rawTotal);
    if (points === 0 && models.every((m) => m.cost === 0)) return null;
    return { points, baseCost, models };
  }

  // Sub-units (e.g. Rapier Battery crews). min=0 variants are optional extras.
  const subUnits = children.filter((e) => e.type === 'unit');
  if (subUnits.length > 0) {
    let rawTotal = 0;
    const models: ModelEntry[] = [];
    for (const s of subUnits) {
      const cost = pointsOf(s);
      const min = selectionConstraint(s, 'min') ?? 1;
      const max = selectionConstraint(s, 'max') ?? min;
      if (min === 0) continue;
      rawTotal += cost * min;
      models.push({ name: s.name, entryId: s.id, cost, min, max, defaultWargear: [] });
    }
    const points = Math.round(baseCost + rawTotal);
    if (points > 0 || baseCost > 0) return { points, baseCost, models };
  }

  if (baseCost > 0) return { points: baseCost, baseCost, models: [] };
  return null;
}

/** Category id → N for every "Officer of the Line (N)" category. */
function buildOfficerOfLineMap(gst: BsRoot): Map<string, number> {
  const map = new Map<string, number>();
  for (const cat of gst.categoryEntries ?? []) {
    const m = cat.name.match(/^Officer of the Line \((\d+)\)$/);
    if (m) map.set(cat.id, parseInt(m[1], 10));
  }
  return map;
}

function officerOfTheLineFor(unit: BsEntry, ootlMap: Map<string, number>): number | undefined {
  let found: number | undefined;
  walk(unit, (obj) => {
    if (found === undefined && typeof obj.targetId === 'string' && ootlMap.has(obj.targetId)) {
      found = ootlMap.get(obj.targetId);
    }
  });
  return found;
}

/**
 * The primary category a root link gives its unit, after applying any
 * *unconditional* `set-primary` modifier (BSData uses these to re-file linked
 * units, e.g. Militia "Infantry Troop" → "Troops - Infantry Troop or Levy Troop only").
 * Conditional modifiers need roster state and are left to the app.
 */
function effectivePrimaryCategory(link: BsEntry, categoryNames: Map<string, string>): string | undefined {
  let primary = link.categoryLinks?.find((c) => c.primary)?.name;
  for (const mod of allModifiers(link)) {
    if (mod.field !== 'category' || mod.type !== 'set-primary') continue;
    if (allConditions(mod).length > 0) continue;
    primary = categoryNames.get(String(mod.value)) ?? primary;
  }
  return primary;
}

/**
 * A catalogue's force-org units are its top-level shared unit entries that the
 * root `entryLinks` expose with a primary category (the battlefield role). The
 * root link's id is what a .ros selection uses as its entryId.
 */
function extractUnitsFromCatalogue(
  cat: BsRoot,
  source: string,
  warnings: string[],
  ootlMap: Map<string, number>,
  slotRoles: Set<string>,
  index: SharedIndex,
  categoryNames: Map<string, string>,
  primeGroupIds: Set<string>
): UnitEntry[] {
  // A unit can be linked several times under different primary categories, e.g.
  // "Transport" and "Transport - Logisticae", or "Master of Automata" and
  // "Support - Castellax Battle Maniple Only". Prefer the plain battlefield-role
  // link; otherwise fall back to the first link.
  const rootLinks = new Map<string, { linkId: string; role: string; link: BsEntry }>();
  const isPlainSlotRole = (role: string) => slotRoles.has(role);
  for (const link of cat.entryLinks ?? []) {
    if (!link.targetId) continue;
    if (link.hidden && !allModifiers(link).some((m) => m.field === 'hidden')) continue; // never shown
    const role = effectivePrimaryCategory(link, categoryNames);
    if (!role) continue;
    const existing = rootLinks.get(link.targetId);
    if (!existing || (!isPlainSlotRole(existing.role) && isPlainSlotRole(role))) {
      rootLinks.set(link.targetId, { linkId: link.id, role, link });
    }
  }

  // The catalogue's own units first (in BSData order), then units it links in
  // from other catalogues — e.g. Skitarii Conclaves fields Mechanicum's Krios
  // and Castellax entries.
  const ownIds = new Set((cat.sharedSelectionEntries ?? []).map((e) => e.id));
  const linkedEntries = [...rootLinks.keys()]
    .filter((id) => !ownIds.has(id))
    .map((id) => index.get(id))
    .filter((e): e is BsEntry => e !== undefined);

  const units: UnitEntry[] = [];
  for (const entry of [...(cat.sharedSelectionEntries ?? []), ...linkedEntries]) {
    if (entry.type !== 'unit') continue;
    const link = rootLinks.get(entry.id);
    if (!link) continue; // not a force-org unit (internal sub-entry)

    const breakdown = extractPointsBreakdown(entry, index);
    if (breakdown === null) warnings.push(`${source}: No points found for "${entry.name}" (id=${entry.id})`);

    const unitWargear = collectMandatoryWargear(entry, index);
    const prime = primeLinkage(entry);
    const officerOfTheLine = officerOfTheLineFor(entry, ootlMap);

    units.push({
      name: entry.name,
      entryId: link.linkId,
      role: normalizeRole(link.role),
      primaryCategory: link.role,
      points: breakdown?.points ?? 0,
      baseCost: breakdown?.baseCost ?? 0,
      models: breakdown?.models ?? [],
      source,
      ...(unitWargear.length > 0 ? { unitWargear } : {}),
      ...(officerOfTheLine !== undefined ? { officerOfTheLine } : {}),
      facts: unitFacts(entry, link.link, breakdown?.models ?? []),
      ...(prime ? { prime } : {}),
    });
    for (const groupId of prime?.groups ?? []) primeGroupIds.add(groupId);
  }
  return units;
}

// ---------------------------------------------------------------------------
// Detachments
// ---------------------------------------------------------------------------

/** A forceEntry's slots are its categoryLinks with a positive max constraint. */
function extractSlots(fe: BsForceEntry): DetachmentSlot[] {
  const slots: DetachmentSlot[] = [];
  for (const link of fe.categoryLinks ?? []) {
    const max = link.constraints?.find((c) => c.type === 'max')?.value ?? 0;
    if (max === 0) continue; // placeholder / disabled slot
    const min = link.constraints?.find((c) => c.type === 'min')?.value ?? 0;
    slots.push({
      role: link.name,
      min,
      max,
      prime: link.name.toLowerCase().startsWith('prime'),
      categoryId: link.targetId,
    });
  }
  return slots;
}

/**
 * Detachments are hidden by default and revealed by `set hidden=false`
 * modifiers conditioned on `instanceOf primary-catalogue <catalogueId>`.
 * Those catalogue ids are exactly the factions that may field it.
 */
function extractFactionSources(fe: BsForceEntry, catalogueKeyById: Map<string, string>): string[] {
  const sources = new Set<string>();
  for (const mod of allModifiers(fe)) {
    if (mod.field !== 'hidden' || mod.type !== 'set' || mod.value !== false) continue;
    for (const cond of allConditions(mod)) {
      if (cond.type !== 'instanceOf' || cond.scope !== 'primary-catalogue' || !cond.childId) continue;
      const key = catalogueKeyById.get(cond.childId);
      if (key) sources.add(key);
    }
  }
  return Array.from(sources).sort();
}

function detachmentType(name: string): Detachment['type'] {
  if (/Primary Detachment$/.test(name) || name === 'Warlord Detachment') return 'core';
  if (/^Auxiliary [-–] /.test(name)) return 'auxiliary';
  if (/^Apex [-–] /.test(name)) return 'apex';
  if (/^Additional [-–] /.test(name)) return 'additional';
  if (name === 'Allied Detachment') return 'allied';
  return 'other';
}

function parseDetachment(fe: BsForceEntry, catalogueKeyById: Map<string, string>): Detachment | null {
  const slots = extractSlots(fe);
  if (slots.length === 0) return null;
  return {
    name: fe.name,
    entryId: fe.id,
    type: detachmentType(fe.name),
    slots,
    sources: extractFactionSources(fe, catalogueKeyById),
  };
}

/** Game-system charts the app supports, by root force entry name. */
const GAME_SYSTEM_CHARTS = [CRUSADE_FORCE_ORG_NAME, 'Allied Detachment and its Auxiliary'];

function parseCharts(
  gst: BsRoot,
  catalogues: Array<{ key: string; root: BsRoot }>,
  catalogueKeyById: Map<string, string>
): ForceChart[] {
  const toChart = (fe: BsForceEntry, catalogue: string | null): ForceChart => ({
    id: fe.id,
    name: fe.name,
    catalogue,
    detachments: (fe.forceEntries ?? [])
      .map((child) => parseDetachment(child, catalogueKeyById))
      .filter((d): d is Detachment => d !== null),
  });
  return [
    ...(gst.forceEntries ?? []).filter((fe) => GAME_SYSTEM_CHARTS.includes(fe.name)).map((fe) => toChart(fe, null)),
    ...catalogues.flatMap(({ key, root }) => (root.forceEntries ?? []).map((fe) => toChart(fe, key))),
  ].filter((chart) => chart.detachments.length > 0);
}

function parseDetachments(gst: BsRoot, catalogueKeyById: Map<string, string>): ParseResult['detachments'] {
  const detachments: ParseResult['detachments'] = { core: [], auxiliary: [], apex: [], legion: {}, charts: [] };
  const crusade = gst.forceEntries?.find((fe) => fe.name === CRUSADE_FORCE_ORG_NAME);

  for (const fe of crusade?.forceEntries ?? []) {
    const detachment = parseDetachment(fe, catalogueKeyById);
    if (!detachment) continue;
    const bucket = detachment.type === 'core' || detachment.type === 'apex' ? detachment.type : 'auxiliary';
    detachments[bucket].push(detachment);
  }
  return detachments;
}

// ---------------------------------------------------------------------------
// parseAll — main exported entry point
// ---------------------------------------------------------------------------

export interface ParseInput {
  gameSystem: BsGameSystemFile;
  /** Every catalogue file — used to resolve catalogue ids to faction keys. */
  catalogues: BsCatalogueFile[];
  /** Faction keys whose units should be extracted (e.g. 'legiones-astartes', 'death-guard'). */
  unitFactions: string[];
}

export function parseAll({ gameSystem, catalogues, unitFactions }: ParseInput): ParseResult {
  const warnings: string[] = [];
  const gst = gameSystem.gameSystem;

  const catalogueByKey = new Map<string, BsRoot>();
  const catalogueKeyById = new Map<string, string>();
  for (const file of catalogues) {
    const key = factionKeyForCatalogue(file.catalogue.name);
    catalogueByKey.set(key, file.catalogue);
    catalogueKeyById.set(file.catalogue.id, key);
  }

  const ootlMap = buildOfficerOfLineMap(gst);
  const index = buildSharedIndex([gst, ...catalogues.map((c) => c.catalogue)]);
  const categoryNames = new Map<string, string>();
  for (const root of [gst, ...catalogues.map((c) => c.catalogue)]) {
    for (const ce of root.categoryEntries ?? []) categoryNames.set(ce.id, ce.name);
  }
  const detachments = parseDetachments(gst, catalogueKeyById);
  detachments.charts = parseCharts(
    gst,
    unitFactions.flatMap((key) => {
      const root = catalogueByKey.get(key);
      return root ? [{ key, root }] : [];
    }),
    catalogueKeyById
  );
  const slotRoles = new Set(
    [...detachments.core, ...detachments.auxiliary, ...detachments.apex]
      .flatMap((d) => d.slots.map((s) => s.role.replace(/^Prime /, '')))
      .filter((role) => !role.includes(' - '))
  );

  const units: Record<string, UnitEntry[]> = {};
  const catalogueInfo: Record<string, CatalogueInfo> = {};
  const primeGroupIds = new Set<string>();

  for (const key of unitFactions) {
    const cat = catalogueByKey.get(key);
    if (!cat) {
      warnings.push(`No catalogue found for faction "${key}"`);
      continue;
    }
    units[key] = extractUnitsFromCatalogue(cat, key, warnings, ootlMap, slotRoles, index, categoryNames, primeGroupIds);
    catalogueInfo[key] = {
      catalogueId: cat.id,
      catalogueName: normalizeCatalogueName(cat.name),
      revision: cat.revision,
    };
  }

  const crusade = gst.forceEntries?.find((fe) => fe.name === CRUSADE_FORCE_ORG_NAME);
  const system: SystemInfo = {
    gameSystemId: gst.id,
    gameSystemName: gst.name.trim(),
    revision: gst.revision,
    forceOrgEntryId: crusade?.id ?? '',
  };

  const sharedRules = new Map<string, BsRule>();
  for (const root of [gst, ...catalogues.map((c) => c.catalogue)]) {
    for (const r of root.sharedRules ?? []) if (!sharedRules.has(r.id)) sharedRules.set(r.id, r);
  }
  const primeGroups: Record<string, PrimeNode> = {};
  for (const groupId of primeGroupIds) {
    const group = index.get(groupId);
    if (group) primeGroups[groupId] = buildPrimeNode({ ...group, type: 'selectionEntryGroup' }, index, sharedRules);
  }

  return {
    units,
    detachments,
    system,
    catalogues: catalogueInfo,
    rules: { primeGroups },
    warnings,
  };
}
