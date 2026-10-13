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

export interface BsRepeat {
  value: number;
  repeats: number;
  field: string;
  scope: string;
  childId?: string;
  roundUp?: boolean;
}

export interface BsModifier {
  type: string;
  field: string;
  value: string | number | boolean;
  repeats?: BsRepeat[];
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
  sortIndex?: number;
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
  constraints?: BsConstraint[];
  costs?: BsCost[];
}

export interface BsCategoryEntry {
  id: string;
  name: string;
  hidden?: boolean;
  constraints?: BsConstraint[];
  modifiers?: BsModifier[];
  modifierGroups?: BsModifierGroup[];
}

interface BsRoot {
  id: string;
  name: string;
  revision: number;
  selectionEntries?: BsEntry[];
  library?: boolean;
  categoryEntries?: BsCategoryEntry[];
  forceEntries?: BsForceEntry[];
  entryLinks?: BsEntry[];
  sharedSelectionEntries?: BsEntry[];
  sharedSelectionEntryGroups?: BsEntry[];
  sharedRules?: BsRule[];
  costTypes?: Array<{ id: string; name: string }>;
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

/**
 * Selection paths follow BattleScribe/New Recruit roster conventions: the
 * entryId of a selection is "::"-joined ids — the root link, then each entry
 * link whose *target* was entered, then the final entry (a link contributes
 * "linkId::targetId"). Children attached to a link itself don't add its id.
 * entryGroupId is the same prefix plus the containing group ("linkId::groupId"
 * for a linked group, the group id for an inline one).
 */
export interface WargearEntry {
  name: string;
  /** The entry's own id (link or inline entry) */
  entryId: string;
  /** How many come per parent selection, when more than one (a pair of sponson weapons) */
  count?: number;
  /** Linked shared entry, when entryId is a link */
  targetId?: string;
  /** Selection entryId path for .ros export */
  path: string;
  /** entryGroupId path, when the entry was chosen from a group */
  groupPath?: string;
  /** The entry's own mandatory/default sub-selections (e.g. a combi weapon's parts) */
  children?: WargearEntry[];
}

export interface ModelEntry {
  name: string;
  entryId: string;
  /** Selection entryId path for .ros export (root link :: model) */
  path: string;
  /** 'unit' for nested sub-units (e.g. Rapier crews), exported as "unit-group" */
  kind?: 'model' | 'unit';
  /** Models inside a sub-unit (kind 'unit') */
  models?: ModelEntry[];
  cost: number;
  min: number;
  max: number;
  defaultWargear: WargearEntry[];
}

export interface UnitEntry {
  name: string;
  /** The root link id (the unit's identity across the app) */
  entryId: string;
  /** Selection entryId path for .ros export (root link :: shared entry) */
  path: string;
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
  /**
   * How the unit links its Prime benefits: the "Prime Unit" link (and its
   * selection path), and each benefit group it offers with the path prefix
   * that the group's relative PrimeNode paths are appended to.
   */
  prime?: { linkId: string; path: string; groups: string[]; groupPrefixes: Record<string, string> };
  /**
   * Conditional re-filings of the unit's primary category, e.g. Tartaros
   * Terminators become "Heavy Assault - Tartaros Only" inside a Linebreaker
   * Echelon (Tartaros). Applied in order when their conditions hold.
   */
  primaryCategoryRules?: Array<{ category: string } & Pick<RuleModifier, 'conditions' | 'conditionGroups'>>;
  /**
   * Other root links to the same unit under different primary categories (e.g.
   * Centurion as "Command - Centurions Only"). A unit placed via one of these
   * exports with that link's id.
   */
  alternateLinks?: Array<{ entryId: string; category: string; categoryIds?: string[] }>;
  /** Categories the unit's root link gives it (replaced when it's fielded through an alternate link) */
  linkCategoryIds?: string[];
  /** Hidden in BSData unless modifiers show it */
  hidden?: boolean;
  /** Its (and its root link's) hidden modifiers — e.g. Sevatar is hidden when the roster is Loyalist */
  visibility?: RuleModifier[];
  /** At most this many in the whole roster (unique characters: 1) */
  rosterMax?: number;
  /**
   * High Command units carry a choice of detachment they unlock ("One Apex /
   * One Auxiliary Detachment"); paths are prefix::choiceId, group prefix::groupId.
   */
  detachmentChoice?: { prefix: string; groupId: string };
}

/**
 * Army-level selections (Allegiance, Rite of War, Cohort Doctrine…): root
 * entries filed under the Allegiance or Army Configuration category.
 */
export interface ArmyConfigEntry {
  name: string;
  category: string;
  /** Id of the primary category, written on the exported selection */
  categoryId: string;
  /** Selection entryId path */
  path: string;
  min: number;
  hidden?: boolean;
  modifiers?: RuleModifier[];
  /** Choices in its first-level groups (e.g. Loyalist/Traitor, each Cohort Doctrine) */
  /** `ids`: what choosing it puts in the roster (its entry, link target and categories) for BSData conditions */
  choices: Array<{ name: string; path: string; groupPath?: string; ids?: string[] }>;
  /** Mandatory/default sub-selections */
  defaults: WargearEntry[];
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
  /** Apply `value` once per `value` selections of `childId` in `scope` (BattleScribe "repeats") */
  repeats?: Array<{ value: number; repeats: number; field: string; scope: string; childId?: string; roundUp?: boolean }>;
}

/** A node in a Prime benefit tree: a group of choices or a choosable benefit. */
export interface PrimeNode {
  /** The entry's own id (link or inline entry) */
  id: string;
  name: string;
  kind: 'group' | 'option';
  /** Ids it also puts in the roster when chosen (its link target, categories) */
  counts?: string[];
  /** Options: selection path relative to the unit's group prefix (see UnitEntry.prime) */
  path?: string;
  /** Options: entryGroupId path relative to the unit's group prefix */
  groupPath?: string;
  hidden?: boolean;
  /** Modifiers that can change visibility (field "hidden") */
  modifiers?: RuleModifier[];
  description?: string;
  children?: PrimeNode[];
}

export interface RulesData {
  /** Prime benefit trees, keyed by the shared group id units link to */
  primeGroups: Record<string, PrimeNode>;
  /**
   * Upgrades a High Command/Command unit carries to record which kind of
   * detachment it unlocked ("One Apex Detachment" / "One Auxiliary Detachment").
   */
  detachmentChoice: {
    apex?: { id: string; name: string; categoryIds?: string[] };
    auxiliary?: { id: string; name: string; categoryIds?: string[] };
  };
  /** Army configuration entries by catalogue key ('game-system' for the game system's own) */
  armyConfig: Record<string, ArmyConfigEntry[]>;
  /**
   * Per-unit choices the builder makes once for the whole army (a Skitarii or
   * Mechanicum unit's sub-faction), keyed by the shared group id that ends the
   * wargear entries' groupPath. Option paths are relative to that group's prefix.
   */
  armyChoices: Record<string, ArmyChoiceGroup>;
}

export interface ArmyChoiceGroup {
  name: string;
  options: Array<{ id: string; name: string; path: string; hidden?: boolean; modifiers?: RuleModifier[] }>;
}

export interface DetachmentSlot {
  role: string;
  min: number;
  max: number;
  prime: boolean;
  /** targetId of the categoryLink — used as the category entryId in .ros exports */
  categoryId: string;
  /**
   * Modifiers on the slot's max (set/increment/decrement, possibly repeated).
   * The app evaluates these against the detachment's contents — e.g. a legion
   * rule turning all Troops Prime, or Logisticae adding Transport slots.
   */
  maxModifiers?: RuleModifier[];
  /** Shown only when these allow (a category hidden until e.g. the Clade Operative benefit is taken) */
  hidden?: boolean;
  visibility?: RuleModifier[];
}

export interface Detachment {
  name: string;
  entryId: string;
  type: 'core' | 'auxiliary' | 'apex' | 'allied' | 'additional' | 'lordOfWar' | 'other';
  slots: DetachmentSlot[];
  /** Faction keys whose primary catalogue can field this detachment (empty = all) */
  sources: string[];
  /** What it uses of its chart's detachment limits, by cost type id (e.g. 1 "Auxiliary Detachment(s)") */
  costs?: Record<string, number>;
  /** How many the roster may contain, raised by modifiers (Knight Additional detachments: +1 per …) */
  rosterMax?: { max: number; modifiers: RuleModifier[] };
  /** BSData error messages and when they apply ("Storm Battery Detachment requires a Siege Breaker") */
  errors?: Array<{ message: string } & Pick<RuleModifier, 'conditions' | 'conditionGroups'>>;
}

/**
 * A cap on a chart's detachments, as BSData encodes it: each detachment "costs"
 * 1 of a cost type (Auxiliary/Apex Detachment(s)) and the chart limits that
 * cost to 0, raised by modifiers per selection (+1 per Command unit, +1 per
 * Officer of the Line (2), +1 per High Command "One Apex Detachment"…).
 */
export interface DetachmentLimit {
  costTypeId: string;
  name: string;
  max: number;
  modifiers: RuleModifier[];
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
  limits?: DetachmentLimit[];
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

/**
 * The primary catalogue of any army fielding the units being extracted, when
 * that's fixed by the source (Skitarii units are only fielded by Skitarii
 * armies; Legiones Astartes units by any Legion, so unknown). Lets the parser
 * settle `primary-catalogue` conditions on wargear constraints.
 */
let knownPrimaryCatalogue: string | undefined;

/** A condition's value at parse time, or undefined if it depends on the roster. */
function conditionAtParse(c: BsCondition): boolean | undefined {
  if (c.scope !== 'primary-catalogue' || !knownPrimaryCatalogue) return undefined;
  const is = c.childId === knownPrimaryCatalogue;
  if (c.type === 'instanceOf') return is;
  if (c.type === 'notInstanceOf') return !is;
  return undefined;
}

function conditionsAtParse(
  holder: { conditions?: BsCondition[]; conditionGroups?: BsConditionGroup[] },
  type = 'and'
): boolean | undefined {
  const results = [
    ...(holder.conditions ?? []).map(conditionAtParse),
    ...(holder.conditionGroups ?? []).map((g) => conditionsAtParse(g, g.type)),
  ];
  if (type === 'or') {
    if (results.some((r) => r === true)) return true;
    return results.every((r) => r === false) ? false : undefined;
  }
  if (results.some((r) => r === false)) return false;
  return results.every((r) => r === true) ? true : undefined;
}

/** A constraint's value after modifiers whose conditions are settled at parse time. */
function constraintValue(holder: BsEntry, c: BsConstraint): number {
  let value = c.value;
  for (const mod of allModifiers(holder)) {
    if (mod.field !== c.id || mod.type !== 'set') continue;
    if (conditionsAtParse(mod) === true) value = Number(mod.value);
  }
  return value;
}

function hasMinAtLeastOne(entry: BsEntry): boolean {
  return entry.constraints?.some((c) => c.type === 'min' && constraintValue(entry, c) >= 1) ?? false;
}

/**
 * Display name after unconditional name modifiers ("set", "prepend", "append"
 * — e.g. a linked unit renamed for its catalogue, "Pintle Mounted" + "Bolter").
 * Holders' modifiers apply in order (target, then the link); undefined if none apply.
 */
function displayName(base: string, ...holders: BsEntry[]): string | undefined {
  let name = base;
  let changed = false;
  for (const h of holders) {
    for (const mod of allModifiers(h)) {
      if (mod.field !== 'name' || allConditions(mod).length > 0) continue;
      const value = String(mod.value);
      const join = (mod as BsModifier & { join?: string }).join ?? ' ';
      if (mod.type === 'set') name = value;
      else if (mod.type === 'prepend') name = `${value}${join}${name}`;
      else if (mod.type === 'append') name = `${name}${join}${value}`;
      else continue;
      changed = true;
    }
  }
  return changed ? name : undefined;
}

/** Options in the order BattleScribe / New Recruit list them: sortIndex, then name. */
function byListOrder(a: Member, b: Member): number {
  const ia = a.entry.sortIndex ?? Number.MAX_SAFE_INTEGER;
  const ib = b.entry.sortIndex ?? Number.MAX_SAFE_INTEGER;
  return ia - ib || a.entry.name.localeCompare(b.entry.name, 'en', { sensitivity: 'base' });
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

/** An entry as reached from some container, with the path prefix in force there. */
interface Member {
  entry: BsEntry;
  prefix: string[];
  /** entryGroupId path of the group it sits in, if any */
  groupPath?: string[];
}

/** A selection group as seen from a container: inline, or a link merged with its target. */
interface GroupView {
  id: string;
  name: string;
  /** The group definition itself (the link target for linked groups) */
  source: BsEntry;
  hidden: boolean;
  constraints?: BsConstraint[];
  modifiers: BsModifier[];
  defaultId?: string;
  groupPath: string[];
  options: Member[];
  groups: GroupView[];
}

const join = (path: string[]) => path.join('::');

/** Selection path of a member: its prefix plus "linkId::targetId" or its own id. */
function memberPath(m: Member): string[] {
  return m.entry.targetId ? [...m.prefix, m.entry.id, m.entry.targetId] : [...m.prefix, m.entry.id];
}

/** Options and groups directly inside a container, with path prefixes. */
function contents(
  container: BsEntry,
  prefix: string[],
  groupPath: string[] | undefined,
  index: SharedIndex,
  depth: number
): { options: Member[]; groups: GroupView[] } {
  const options: Member[] = [];
  const groups: GroupView[] = [];
  if (depth > 8) return { options, groups }; // guard against link cycles
  for (const e of container.selectionEntries ?? []) options.push({ entry: e, prefix, groupPath });
  for (const l of container.entryLinks ?? []) {
    if (l.type === 'selectionEntryGroup') {
      const g = linkedGroup(l, prefix, index, depth);
      if (g) groups.push(g);
    } else {
      options.push({ entry: l, prefix, groupPath });
    }
  }
  for (const g of container.selectionEntryGroups ?? []) {
    const gp = [...prefix, g.id];
    groups.push({
      id: g.id,
      name: g.name,
      source: g,
      hidden: Boolean(g.hidden),
      constraints: g.constraints,
      modifiers: allModifiers(g),
      defaultId: g.defaultSelectionEntryId,
      groupPath: gp,
      ...contents(g, prefix, gp, index, depth + 1),
    });
  }
  return { options, groups };
}

/** A group reached through an entry link: the target's contents (prefix + link id) plus the link's own children. */
function linkedGroup(link: BsEntry, prefix: string[], index: SharedIndex, depth: number): GroupView | undefined {
  const target = link.targetId ? index.get(link.targetId) : undefined;
  if (!target) return undefined;
  const gp = [...prefix, link.id, target.id];
  const fromTarget = contents(target, [...prefix, link.id], gp, index, depth + 1);
  const fromLink = contents(link, prefix, gp, index, depth + 1);
  return {
    id: link.id,
    name: link.name,
    source: target,
    hidden: Boolean(link.hidden || target.hidden),
    constraints: link.constraints ?? target.constraints,
    modifiers: [...allModifiers(link), ...allModifiers(target)],
    defaultId: link.defaultSelectionEntryId ?? target.defaultSelectionEntryId,
    groupPath: gp,
    options: [...fromTarget.options, ...fromLink.options],
    groups: [...fromTarget.groups, ...fromLink.groups],
  };
}

/** Contents of an option's own subtree: into its target (prefix + link id) and its link-level children. */
function optionContents(m: Member, index: SharedIndex, depth: number): { options: Member[]; groups: GroupView[] } {
  const { entry, prefix } = m;
  if (!entry.targetId) return contents(entry, prefix, undefined, index, depth + 1);
  const target = index.get(entry.targetId);
  const fromTarget = target
    ? contents(target, [...prefix, entry.id], undefined, index, depth + 1)
    : { options: [], groups: [] };
  const fromLink = contents(entry, prefix, undefined, index, depth + 1);
  return { options: [...fromTarget.options, ...fromLink.options], groups: [...fromTarget.groups, ...fromLink.groups] };
}

function isGroupDisabled(g: GroupView): boolean {
  const maxZero = g.constraints?.some((c) => c.type === 'max' && c.field === 'selections' && c.value === 0) ?? false;
  return maxZero && g.modifiers.length === 0;
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
 * themselves are never emitted — only concrete selections, with their paths.
 */
function collectMandatoryWargear(node: BsEntry, prefix: string[], index: SharedIndex): WargearEntry[] {
  return mandatoryIn(contents(node, prefix, undefined, index, 0), index, 0);
}

function mandatoryIn(
  root: { options: Member[]; groups: GroupView[] },
  index: SharedIndex,
  depth: number
): WargearEntry[] {
  const wargear: WargearEntry[] = [];
  const add = (m: Member) => {
    if (wargear.some((w) => w.entryId === m.entry.id)) return;
    const children = depth < 4 ? mandatoryIn(optionContents(m, index, depth), index, depth + 1) : [];
    // How many come with it (e.g. "Two Sponson Mounted" heavy bolters: min 2)
    const min = Math.max(0, ...(m.entry.constraints ?? []).filter((c) => c.type === 'min' && c.field === 'selections').map((c) => constraintValue(m.entry, c)));
    const target = m.entry.targetId ? index.get(m.entry.targetId) : undefined;
    wargear.push({
      // The name New Recruit shows ("Hull (Front) Mounted heavy bolter")
      name: displayName(m.entry.name, ...(target ? [target] : []), m.entry) ?? m.entry.name,
      ...(min > 1 ? { count: min } : {}),
      entryId: m.entry.id,
      ...(m.entry.targetId ? { targetId: m.entry.targetId } : {}),
      path: join(memberPath(m)),
      ...(m.groupPath ? { groupPath: join(m.groupPath) } : {}),
      ...(children.length > 0 ? { children } : {}),
    });
  };

  const visit = (c: { options: Member[]; groups: GroupView[] }) => {
    for (const m of c.options) {
      const e = m.entry;
      if (e.hidden || e.type === 'model' || e.type === 'unit') continue;
      if (hasMinAtLeastOne(e) && !isDisabled(e)) add(m);
    }
    for (const g of c.groups) {
      if (g.hidden || isGroupDisabled(g) || FORCE_ORG_CHOICE_GROUP_IDS.has(g.source.id)) continue;
      // A group's default is pre-selected only when the group requires a choice
      // (min ≥ 1) — matches New Recruit (e.g. no default chainsword on a sergeant)
      const requiresChoice = g.constraints?.some((c) => c.type === 'min' && c.field === 'selections' && c.value >= 1);
      if (requiresChoice) {
        // The default; with no usable default, the first visible free option (the
        // sole one for a Despoiler's Pistol group; a Skitarii unit's sub-faction
        // or an Ordinatus' weapon otherwise) — so the export is a legal roster
        // and the choice can be changed in New Recruit. Options a modifier may
        // hide are taken only if nothing else is left.
        // Free options first, so the unit's points stay as the app shows them
        const cost = (o: Member) => pointsOf(o.entry) + (o.entry.targetId ? pointsOf(index.get(o.entry.targetId) ?? {}) : 0);
        const pick = (grp: GroupView): Member | undefined => {
          const visible = grp.options
            .filter((o) => !o.entry.hidden && !isDisabled(o.entry))
            .sort((a, b) => Number(cost(a) > 0) - Number(cost(b) > 0) || byListOrder(a, b));
          const steady = visible.filter((o) => !allModifiers(o.entry).some((m) => m.field === 'hidden'));
          const subgroups = grp.groups.filter((sg) => !sg.hidden && !isGroupDisabled(sg));
          // A group of sub-groups (an Assault Squad's "Pistol") takes a sub-group's default
          const fromSubgroups = () => {
            for (const sg of subgroups) {
              const d = sg.options.find((o) => o.entry.id === sg.defaultId);
              if (d) return d;
            }
            for (const sg of subgroups) {
              const p = pick(sg);
              if (p) return p;
            }
            return undefined;
          };
          return grp.options.find((o) => o.entry.id === grp.defaultId) ?? steady[0] ?? visible[0] ?? fromSubgroups();
        };
        const choice = pick(g);
        if (choice) add(choice);
      }
      visit(g);
    }
  };

  visit(root);
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
  const repeats = m.repeats?.map((r) => ({
    value: r.value,
    repeats: r.repeats,
    field: r.field,
    scope: r.scope,
    ...(r.childId ? { childId: r.childId } : {}),
    ...(r.roundUp ? { roundUp: true } : {}),
  }));
  return { type: m.type, field: m.field, value: m.value, ...slimConditions(m), ...(repeats?.length ? { repeats } : {}) };
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
  // Categories added unconditionally (a Siege Breaker's "Siege Breaker", which unlocks a Storm Battery)
  for (const m of [...allModifiers(unit), ...allModifiers(rootLink)]) {
    if (m.field === 'category' && m.type === 'add' && allConditions(m).length === 0) add(String(m.value), 1);
  }
  const modelDefs = new Map(
    [...(unit.selectionEntries ?? []), ...(unit.selectionEntryGroups ?? []).flatMap((g) => g.selectionEntries ?? [])].map(
      (e) => [e.id, e]
    )
  );
  for (const m of models) {
    add(m.entryId, m.min);
    for (const c of modelDefs.get(m.entryId)?.categoryLinks ?? []) add(c.targetId, m.min);
    for (const w of m.defaultWargear) {
      add(w.entryId, m.min);
      add(w.targetId, m.min);
    }
  }
  return facts;
}

/** "One Apex Detachment" / "One Auxiliary Detachment" from the High Command Detachment Choice group. */
function detachmentChoiceIds(index: SharedIndex): RulesData['detachmentChoice'] {
  const choices: RulesData['detachmentChoice'] = {};
  for (const groupId of FORCE_ORG_CHOICE_GROUP_IDS) {
    const group = index.get(groupId);
    for (const e of [...(group?.selectionEntries ?? []), ...(group?.entryLinks ?? [])]) {
      // Its categories ("+1 Apex from High Command") are what the chart limits count
      const categoryIds = (e.categoryLinks ?? []).map((c) => c.targetId);
      if (/^One Apex Detachment/i.test(e.name)) choices.apex = { id: e.id, name: e.name, categoryIds };
      if (/^One Auxiliary Detachment/i.test(e.name)) choices.auxiliary = { id: e.id, name: e.name, categoryIds };
    }
  }
  return choices;
}

/** The game system's shared "Prime Unit" upgrade that every prime-capable unit links. */
const PRIME_UNIT_NAME = 'Prime Unit';

function primeLinkage(unit: BsEntry, rootLinkId: string): UnitEntry['prime'] {
  const link = (unit.entryLinks ?? []).find((l) => l.name === PRIME_UNIT_NAME && l.targetId);
  if (!link) return undefined;
  // Benefit groups are children of the Prime Unit link itself, so the link's id
  // isn't part of their paths: "root::groupLink::…"
  const groupLinks = (link.entryLinks ?? []).filter((l) => l.type === 'selectionEntryGroup' && l.targetId);
  if (groupLinks.length === 0) return undefined;
  return {
    linkId: link.id,
    path: join([rootLinkId, link.id, link.targetId as string]),
    groups: groupLinks.map((l) => l.targetId as string),
    groupPrefixes: Object.fromEntries(groupLinks.map((l) => [l.targetId as string, join([rootLinkId, l.id])])),
  };
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

const ARMY_CONFIG_CATEGORIES = new Set(['Allegiance', 'Army Configuration']);

/** A root entry's army-config definition, or undefined if it isn't one. */
function armyConfigEntry(
  entry: BsEntry,
  index: SharedIndex,
  categoryNames: Map<string, string>
): ArmyConfigEntry | undefined {
  const target = entry.targetId ? index.get(entry.targetId) : undefined;
  const primary = [...(entry.categoryLinks ?? []), ...(target?.categoryLinks ?? [])].find((c) => c.primary);
  const category = primary ? categoryNames.get(primary.targetId) ?? primary.name : undefined;
  if (!category || !ARMY_CONFIG_CATEGORIES.has(category)) return undefined;

  // A root link enters its target (prefix = link id); a root inline entry starts fresh
  const member: Member = { entry, prefix: [] };
  const inner = optionContents(member, index, 0);
  const choices = inner.groups.flatMap((g) =>
    g.options.map((o) => {
      const target = o.entry.targetId ? index.get(o.entry.targetId) : undefined;
      const ids = [
        o.entry.id,
        ...(target ? [target.id] : []),
        ...[...(o.entry.categoryLinks ?? []), ...(target?.categoryLinks ?? [])].map((c) => c.targetId),
      ];
      return {
        name: o.entry.name,
        path: join(memberPath(o)),
        ...(o.groupPath ? { groupPath: join(o.groupPath) } : {}),
        ids,
      };
    })
  );
  const constraints = [...(entry.constraints ?? []), ...(target?.constraints ?? [])];
  const min = Math.max(0, ...constraints.filter((c) => c.type === 'min' && c.field === 'selections').map((c) => c.value));
  const mods = hiddenModifiers([...allModifiers(entry), ...(target ? allModifiers(target) : [])]);
  return {
    name: entry.name.trim().replace(/:$/, ''),
    category,
    // New Recruit files root selections under their primary category; without
    // it they don't count towards e.g. "Allegiance (1/1)"
    categoryId: primary!.targetId,
    path: join(memberPath(member)),
    min,
    ...(entry.hidden || target?.hidden ? { hidden: true } : {}),
    ...(mods.length > 0 ? { modifiers: mods } : {}),
    choices,
    defaults: mandatoryIn(inner, index, 0),
  };
}

function extractArmyConfig(root: BsRoot, index: SharedIndex, categoryNames: Map<string, string>): ArmyConfigEntry[] {
  return [...(root.selectionEntries ?? []), ...(root.entryLinks ?? [])]
    .map((e) => armyConfigEntry(e, index, categoryNames))
    .filter((e): e is ArmyConfigEntry => e !== undefined);
}

/** Hidden-related modifiers, slimmed. */
function hiddenModifiers(mods: BsModifier[]): RuleModifier[] {
  return mods.filter((m) => m.field === 'hidden').map(slimModifier);
}

/**
 * A Prime benefit tree for a shared benefit group, with option paths relative to
 * the group's entry (each unit prepends its own "root::groupLink" prefix).
 */
function buildPrimeTree(group: BsEntry, index: SharedIndex, rules: Map<string, BsRule>): PrimeNode {
  const fromGroup = (g: GroupView, depth: number): PrimeNode => {
    const children = [
      ...g.options.map((o) => fromOption(o, depth)),
      ...g.groups.map((sub) => fromGroup(sub, depth + 1)),
    ];
    const mods = hiddenModifiers(g.modifiers);
    return {
      id: g.id,
      name: g.name.trim(),
      kind: 'group',
      ...(g.hidden ? { hidden: true } : {}),
      ...(mods.length > 0 ? { modifiers: mods } : {}),
      ...(children.length > 0 ? { children } : {}),
    };
  };
  const fromOption = (m: Member, depth: number): PrimeNode => {
    const e = m.entry;
    const target = e.targetId ? index.get(e.targetId) : undefined;
    const mods = hiddenModifiers([...allModifiers(e), ...(target ? allModifiers(target) : [])]);
    const sub = depth < 6 ? optionContents(m, index, depth) : { options: [], groups: [] };
    const children = [
      ...sub.options.map((o) => fromOption(o, depth + 1)),
      ...sub.groups.map((g) => fromGroup(g, depth + 1)),
    ];
    const description = describe(target ?? e, rules);
    // What choosing it puts in the roster besides its own id: the link's target
    // and categories (conditions often name the target, e.g. Clade Operative)
    const also = [...(target ? [target.id] : []), ...[...(e.categoryLinks ?? []), ...(target?.categoryLinks ?? [])].map((c) => c.targetId)];
    return {
      id: e.id,
      name: e.name.trim(),
      kind: 'option',
      ...(also.length > 0 ? { counts: also } : {}),
      path: join(memberPath(m)),
      ...(m.groupPath ? { groupPath: join(m.groupPath) } : {}),
      ...(e.hidden || target?.hidden ? { hidden: true } : {}),
      ...(mods.length > 0 ? { modifiers: mods } : {}),
      ...(description ? { description } : {}),
      ...(children.length > 0 ? { children } : {}),
    };
  };
  const view: GroupView = {
    id: group.id,
    name: group.name,
    source: group,
    hidden: Boolean(group.hidden),
    constraints: group.constraints,
    modifiers: allModifiers(group),
    defaultId: group.defaultSelectionEntryId,
    groupPath: [group.id],
    ...contents(group, [], [group.id], index, 0),
  };
  return fromGroup(view, 0);
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

interface PointsBreakdown {
  points: number;
  baseCost: number;
  models: ModelEntry[];
}

function extractPointsBreakdown(unit: BsEntry, rootLinkId: string, index: SharedIndex): PointsBreakdown | null {
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
      return {
        name: m.name,
        entryId: m.id,
        path: join([rootLinkId, m.id]),
        cost,
        min,
        max,
        defaultWargear: collectMandatoryWargear(m, [rootLinkId], index),
      };
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
      const inner = (s.selectionEntries ?? [])
        .filter((e) => e.type === 'model')
        .map((m): ModelEntry => {
          const mMin = selectionConstraint(m, 'min') ?? 1;
          return {
            name: m.name,
            entryId: m.id,
            path: join([rootLinkId, m.id]),
            cost: pointsOf(m),
            min: mMin,
            max: selectionConstraint(m, 'max') ?? mMin,
            defaultWargear: collectMandatoryWargear(m, [rootLinkId], index),
          };
        });
      models.push({
        name: s.name,
        entryId: s.id,
        path: join([rootLinkId, s.id]),
        kind: 'unit',
        cost,
        min,
        max,
        defaultWargear: collectMandatoryWargear(s, [rootLinkId], index),
        ...(inner.length > 0 ? { models: inner } : {}),
      });
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

/** Conditional set-primary modifiers on a unit's root link and shared entry, with category names. */
function primaryCategoryRules(
  link: BsEntry,
  target: BsEntry,
  categoryNames: Map<string, string>
): UnitEntry['primaryCategoryRules'] {
  const rules = [...allModifiers(link), ...allModifiers(target)]
    .filter((m) => m.field === 'category' && m.type === 'set-primary' && allConditions(m).length > 0)
    .map((m) => {
      const { conditions, conditionGroups } = slimModifier(m);
      return {
        category: categoryNames.get(String(m.value)) ?? String(m.value),
        ...(conditions ? { conditions } : {}),
        ...(conditionGroups ? { conditionGroups } : {}),
      };
    });
  return rules.length > 0 ? rules : undefined;
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
  const allRootLinks = new Map<string, Array<{ entryId: string; category: string; categoryIds: string[] }>>();
  const isPlainSlotRole = (role: string) => slotRoles.has(role);
  for (const link of cat.entryLinks ?? []) {
    if (!link.targetId) continue;
    if (link.hidden && !allModifiers(link).some((m) => m.field === 'hidden')) continue; // never shown
    const role = effectivePrimaryCategory(link, categoryNames);
    if (!role) continue;
    allRootLinks.set(link.targetId, [
      ...(allRootLinks.get(link.targetId) ?? []),
      { entryId: link.id, category: role, categoryIds: (link.categoryLinks ?? []).map((c) => c.targetId) },
    ]);
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

    const breakdown = extractPointsBreakdown(entry, link.linkId, index);
    if (breakdown === null) warnings.push(`${source}: No points found for "${entry.name}" (id=${entry.id})`);

    // The unit's own wargear, plus anything attached to its root link (e.g.
    // Skitarii's sub-faction choice on a linked Mechanicum unit) — link-level
    // children don't take the link's id in their path
    const unitWargear = [
      ...collectMandatoryWargear(entry, [link.linkId], index),
      ...collectMandatoryWargear(link.link, [], index),
    ];
    const prime = primeLinkage(entry, link.linkId);
    const categoryRules = primaryCategoryRules(link.link, entry, categoryNames);
    const alternateLinks = (allRootLinks.get(entry.id) ?? []).filter((l) => l.entryId !== link.linkId);
    const choiceLink = (entry.entryLinks ?? []).find((l) => FORCE_ORG_CHOICE_GROUP_IDS.has(l.targetId ?? ''));
    const officerOfTheLine = officerOfTheLineFor(entry, ootlMap);

    const visibility = hiddenModifiers([...allModifiers(entry), ...allModifiers(link.link)]);
    const rosterMax = [...(entry.constraints ?? []), ...(link.link.constraints ?? [])]
      .filter((c) => c.type === 'max' && c.field === 'selections' && c.scope === 'roster')
      .map((c) => c.value)
      .sort((a, b) => a - b)[0];
    units.push({
      name: displayName(entry.name, entry, link.link) ?? entry.name,
      ...(entry.hidden || link.link.hidden ? { hidden: true } : {}),
      ...(visibility.length > 0 ? { visibility } : {}),
      ...(rosterMax !== undefined ? { rosterMax } : {}),
      entryId: link.linkId,
      path: join([link.linkId, entry.id]),
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
      ...(categoryRules ? { primaryCategoryRules: categoryRules } : {}),
      ...(alternateLinks.length > 0
        ? { alternateLinks, linkCategoryIds: (link.link.categoryLinks ?? []).map((c) => c.targetId) }
        : {}),
      ...(choiceLink
        ? { detachmentChoice: { prefix: join([link.linkId, choiceLink.id]), groupId: choiceLink.targetId as string } }
        : {}),
    });
    for (const groupId of prime?.groups ?? []) primeGroupIds.add(groupId);
  }
  return units;
}

// ---------------------------------------------------------------------------
// Army-wide unit choices
// ---------------------------------------------------------------------------

/** Shared groups chosen per unit in BSData that the builder picks once per army. */
const ARMY_CHOICE_GROUP_NAME = /sub[\s-]?factions?$/i;

/** Groups the extracted units take a choice from (their wargear's last groupPath segment). */
function usedGroupIds(units: UnitEntry[]): Set<string> {
  const ids = new Set<string>();
  const visit = (ws: WargearEntry[] | undefined) => {
    for (const w of ws ?? []) {
      if (w.groupPath) ids.add(w.groupPath.split('::').pop() as string);
      visit(w.children);
    }
  };
  for (const u of units) {
    visit(u.unitWargear);
    for (const m of u.models) visit(m.defaultWargear);
  }
  return ids;
}

function extractArmyChoices(units: UnitEntry[], index: SharedIndex): Record<string, ArmyChoiceGroup> {
  const out: Record<string, ArmyChoiceGroup> = {};
  for (const id of usedGroupIds(units)) {
    const group = index.get(id);
    if (!group || !ARMY_CHOICE_GROUP_NAME.test(group.name)) continue;
    const members = contents(group, [], undefined, index, 0).options.sort(byListOrder);
    out[id] = {
      name: group.name,
      options: members.map((m) => {
        const mods = hiddenModifiers(allModifiers(m.entry));
        return {
          id: m.entry.id,
          name: m.entry.name,
          path: join(memberPath(m)),
          ...(m.entry.hidden ? { hidden: true } : {}),
          ...(mods.length > 0 ? { modifiers: mods } : {}),
        };
      }),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detachments
// ---------------------------------------------------------------------------

/** A forceEntry's slots are its categoryLinks with a positive max constraint. */
/**
 * A forceEntry's slots are its categoryLinks with a max constraint that is
 * positive, or zero but raisable by a modifier (e.g. a slot a Logistical
 * Benefit or a legion rule opens up).
 */
function extractSlots(fe: BsForceEntry, categories: Map<string, BsCategoryEntry>): DetachmentSlot[] {
  const slots: DetachmentSlot[] = [];
  for (const link of fe.categoryLinks ?? []) {
    // A link without its own limit takes its category's (e.g. "Clade Operative":
    // up to 3, hidden until the Clade Operative benefit is in the detachment)
    const category = categories.get(link.targetId);
    const own = link.constraints?.find((c) => c.type === 'max');
    const maxConstraint = own ?? category?.constraints?.find((c) => c.type === 'max' && c.field === 'selections');
    if (!maxConstraint) continue;
    const holder = own ? link : category!;
    const maxModifiers = maxConstraint.id
      ? allModifiers(holder).filter((m) => m.field === maxConstraint.id).map(slimModifier)
      : [];
    const visibility = own ? [] : hiddenModifiers(allModifiers(category!));
    const canRaise = maxModifiers.some((m) => m.type === 'increment' || (m.type === 'set' && Number(m.value) > 0));
    if (maxConstraint.value === 0 && !canRaise) continue; // placeholder / disabled slot
    const min = link.constraints?.find((c) => c.type === 'min')?.value ?? 0;
    slots.push({
      role: link.name,
      min,
      max: maxConstraint.value,
      prime: link.name.toLowerCase().startsWith('prime'),
      categoryId: link.targetId,
      ...(maxModifiers.length > 0 ? { maxModifiers } : {}),
      ...(!own && category?.hidden ? { hidden: true } : {}),
      ...(visibility.length > 0 ? { visibility } : {}),
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
  if (name === 'Lord of War Detachment') return 'lordOfWar';
  return 'other';
}

function parseDetachment(
  fe: BsForceEntry,
  catalogueKeyById: Map<string, string>,
  categories: Map<string, BsCategoryEntry>
): Detachment | null {
  const slots = extractSlots(fe, categories);
  if (slots.length === 0) return null;
  const costs: Record<string, number> = {};
  for (const c of fe.costs ?? []) {
    if (c.typeId !== POINTS_TYPE_ID && c.value > 0) costs[c.typeId] = c.value;
  }
  // A roster-wide cap on this detachment, with the modifiers that raise it
  const cap = (fe.constraints ?? []).find((c) => c.type === 'max' && c.field === 'forces' && c.scope === 'roster');
  const rosterMax = cap
    ? { max: cap.value, modifiers: allModifiers(fe).filter((m) => cap.id && m.field === cap.id).map(slimModifier) }
    : undefined;
  const errors = allModifiers(fe)
    .filter((m) => m.field === 'error' && m.type === 'add')
    .map((m) => {
      const { conditions, conditionGroups } = slimModifier(m);
      return { message: String(m.value), ...(conditions ? { conditions } : {}), ...(conditionGroups ? { conditionGroups } : {}) };
    });
  return {
    name: fe.name,
    entryId: fe.id,
    type: detachmentType(fe.name),
    slots,
    sources: extractFactionSources(fe, catalogueKeyById),
    ...(Object.keys(costs).length > 0 ? { costs } : {}),
    ...(rosterMax ? { rosterMax } : {}),
    ...(errors.length > 0 ? { errors } : {}),
  };
}

/** Chart-level caps on detachments: `max` constraints on non-points cost types, with their modifiers. */
function extractLimits(fe: BsForceEntry, costTypeNames: Map<string, string>): DetachmentLimit[] {
  const modifiers = allModifiers(fe);
  return (fe.constraints ?? [])
    // Detachment counts (scope self) and the army's points share (Lord of War: a
    // quarter of the points limit, scope roster)
    .filter(
      (c) =>
        c.type === 'max' &&
        costTypeNames.has(c.field) &&
        (c.field === POINTS_TYPE_ID ? c.scope === 'roster' : c.scope === 'self')
    )
    .map((c) => ({
      costTypeId: c.field,
      name: costTypeNames.get(c.field) as string,
      max: c.value,
      modifiers: modifiers.filter((m) => m.field === c.id && c.id).map(slimModifier),
    }));
}

/** Game-system charts the app supports, by root force entry name. */
const GAME_SYSTEM_CHARTS = [CRUSADE_FORCE_ORG_NAME, 'Allied Detachment and its Auxiliary', 'Lord of War Detachment'];

function parseCharts(
  gst: BsRoot,
  catalogues: Array<{ key: string; root: BsRoot }>,
  catalogueKeyById: Map<string, string>
): ForceChart[] {
  const costTypeNames = new Map((gst.costTypes ?? []).map((t) => [t.id, t.name]));
  const categories = new Map(
    [gst, ...catalogues.map((c) => c.root)].flatMap((r) => r.categoryEntries ?? []).map((c) => [c.id, c])
  );
  const toChart = (fe: BsForceEntry, catalogue: string | null): ForceChart => {
    // The chart's caps, plus a points share set on its detachment (Knight Lord of War)
    const limits = [
      ...extractLimits(fe, costTypeNames),
      ...(fe.forceEntries ?? []).flatMap((child) =>
        extractLimits(child, costTypeNames).filter((l) => l.costTypeId === POINTS_TYPE_ID)
      ),
    ];
    return {
      id: fe.id,
      name: fe.name,
      catalogue,
      // A chart without child forces (Lord of War Detachment) holds its units
      // itself: it is its own single detachment
      detachments: (fe.forceEntries?.length ? fe.forceEntries : [fe])
        .map((child) => parseDetachment(child, catalogueKeyById, categories))
        .filter((d): d is Detachment => d !== null),
      ...(limits.length > 0 ? { limits } : {}),
    };
  };
  return [
    ...(gst.forceEntries ?? []).filter((fe) => GAME_SYSTEM_CHARTS.includes(fe.name)).map((fe) => toChart(fe, null)),
    ...catalogues.flatMap(({ key, root }) => (root.forceEntries ?? []).map((fe) => toChart(fe, key))),
  ].filter((chart) => chart.detachments.length > 0);
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
  const detachments: ParseResult['detachments'] = { charts: [] };
  detachments.charts = parseCharts(
    gst,
    unitFactions.flatMap((key) => {
      const root = catalogueByKey.get(key);
      return root ? [{ key, root }] : [];
    }),
    catalogueKeyById
  );
  const slotRoles = new Set(
    detachments.charts
      .flatMap((c) => c.detachments)
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
    // Shared Legiones Astartes units are fielded under every Legion's catalogue
    knownPrimaryCatalogue = key === 'legiones-astartes' ? undefined : cat.id;
    units[key] = extractUnitsFromCatalogue(cat, key, warnings, ootlMap, slotRoles, index, categoryNames, primeGroupIds);
    knownPrimaryCatalogue = undefined;
    catalogueInfo[key] = {
      catalogueId: cat.id,
      catalogueName: normalizeCatalogueName(cat.name),
      revision: cat.revision,
    };
  }

  // Drop slots no unit can be filed under — BSData markers such as the Lord of
  // War Detachment's "Use a Knight Lord of War force instead"
  const fillable = new Set<string>();
  for (const u of Object.values(units).flat()) {
    for (const c of [u.primaryCategory, ...(u.alternateLinks ?? []).map((l) => l.category), ...(u.primaryCategoryRules ?? []).map((r) => r.category)]) {
      if (c) fillable.add(c);
    }
  }
  for (const chart of detachments.charts) {
    for (const det of chart.detachments) {
      det.slots = det.slots.filter((s) => {
        const role = s.role.replace(/^Prime /, '');
        return fillable.has(role) || fillable.has(role.split(' - ')[0]) || s.min > 0;
      });
    }
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
    if (group) primeGroups[groupId] = buildPrimeTree(group, index, sharedRules);
  }

  return {
    units,
    detachments,
    system,
    catalogues: catalogueInfo,
    rules: {
      primeGroups,
      detachmentChoice: detachmentChoiceIds(index),
      armyChoices: extractArmyChoices(Object.values(units).flat(), index),
      armyConfig: {
        'game-system': extractArmyConfig(gst, index, categoryNames),
        ...Object.fromEntries(
          unitFactions.flatMap((key) => {
            const root = catalogueByKey.get(key);
            return root ? [[key, extractArmyConfig(root, index, categoryNames)]] : [];
          })
        ),
      },
    },
    warnings,
  };
}
