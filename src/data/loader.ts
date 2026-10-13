import unitsJson from '../../data/parsed/units.json';
import detachmentsJson from '../../data/parsed/detachments.json';
import systemJson from '../../data/parsed/system.json';
import cataloguesJson from '../../data/parsed/catalogues.json';
import rulesJson from '../../data/parsed/rules.json';
import type { UnitEntry, DetachmentDef, ModelEntry, WargearEntry } from '../types';
import type { PrimeNode } from '../rules/primeBenefits';
import type { RuleModifier } from '../rules/evaluate';
import { ALLIED_CHART, ALLIED_DETACHMENT, CRUSADE_CHART, FACTIONS, FACTION_BY_ID, LORD_OF_WAR_CHART } from './factions';

export const unitsData = unitsJson as unknown as Record<string, UnitEntry[]>;

export interface SystemInfo {
  gameSystemId: string;
  gameSystemName: string;
  revision: number;
  forceOrgEntryId: string;
  /** BSData commit the data was synced from */
  bsdataCommit?: string;
  bsdataCommitDate?: string;
}

export interface CatalogueInfo {
  catalogueId: string;
  catalogueName: string;
  revision: number;
}

export const systemData = systemJson as SystemInfo;

/** Rules trees (Prime benefits) with BSData conditions — see src/rules/ */
/** An army-level selection (Allegiance, Rite of War, Cohort Doctrine…) — see scripts/parse-bsdata.ts */
export interface ArmyConfigEntry {
  name: string;
  category: string;
  /** Id of the primary category, written on the exported selection */
  categoryId: string;
  path: string;
  min: number;
  hidden?: boolean;
  modifiers?: RuleModifier[];
  /** How many of `choices` must / may be picked (its choice group's constraints) */
  pick?: { min: number; max: number };
  /** `ids`: what choosing it puts in the roster (its entry, link target and categories) for BSData conditions */
  choices: Array<{ name: string; path: string; groupPath?: string; ids?: string[] }>;
  defaults: WargearEntry[];
}

export const rulesData = rulesJson as unknown as {
  primeGroups: Record<string, PrimeNode>;
  detachmentChoice: {
    apex?: { id: string; name: string; categoryIds?: string[] };
    auxiliary?: { id: string; name: string; categoryIds?: string[] };
  };
  /** Army configuration entries by catalogue key ('game-system' for the game system's own) */
  armyConfig: Record<string, ArmyConfigEntry[]>;
  /** Per-unit choices made once for the army (sub-factions), by shared group id */
  armyChoices: Record<string, ArmyChoiceGroup>;
};

/** A per-unit BSData choice the builder makes once for the whole army — see scripts/parse-bsdata.ts */
export interface ArmyChoiceGroup {
  name: string;
  options: Array<{ id: string; name: string; path: string; hidden?: boolean; modifiers?: RuleModifier[] }>;
}
export const cataloguesData = cataloguesJson as Record<string, CatalogueInfo>;

/** A root force entry and the detachments it may contain (mirrors a .ros root <force>). */
export interface ForceChartDef {
  id: string;
  name: string;
  catalogue: string | null;
  detachments: DetachmentDef[];
  /** Caps on the chart's detachments (Auxiliary/Apex Detachment(s)) — see rules/detachmentLimits.ts */
  limits?: Array<{ costTypeId: string; name: string; max: number; modifiers: RuleModifier[] }>;
}

const charts = (detachmentsJson as unknown as { charts: ForceChartDef[] }).charts;
const crusadeDetachments = charts.find((c) => c.name === CRUSADE_CHART)?.detachments ?? [];

/** Force org charts, plus the Crusade chart's detachments bucketed by type. */
export const detachmentsData = {
  charts,
  core: crusadeDetachments.filter((d) => d.type === 'core'),
  apex: crusadeDetachments.filter((d) => d.type === 'apex'),
  auxiliary: crusadeDetachments.filter((d) => d.type !== 'core' && d.type !== 'apex'),
};

/**
 * The Lord of War chart an army uses: its own catalogue's (Knights' "Knight
 * Lord of War"), else the game system's "Lord of War Detachment".
 */
export function lordOfWarChartFor(faction: string): ForceChartDef | undefined {
  const sources = FACTION_BY_ID[faction]?.unitSources ?? [faction];
  return (
    charts.find((c) => c.catalogue && sources.includes(c.catalogue) && /Lord of War/i.test(c.name)) ??
    charts.find((c) => c.name === LORD_OF_WAR_CHART)
  );
}

export function hasChart(name: string): boolean {
  return charts.some((c) => c.name === name);
}

export function getChart(name: string): ForceChartDef {
  const chart = detachmentsData.charts.find((c) => c.name === name);
  if (!chart) throw new Error(`Force org chart "${name}" not found in data`);
  return chart;
}

export function getChartDetachment(chartName: string, detachmentName: string): DetachmentDef {
  const def = getChart(chartName).detachments.find((d) => d.name === detachmentName);
  if (!def) throw new Error(`Detachment "${detachmentName}" not found in chart "${chartName}"`);
  return def;
}

/** Returns all units available to a faction, merging its unit sources (e.g. Legiones Astartes base + legion). */
export function getUnitsForFaction(faction: string): UnitEntry[] {
  const sources = FACTION_BY_ID[faction]?.unitSources ?? [faction];
  return sources.flatMap((key) => unitsData[key] ?? []);
}

/** Factions that may join `primaryFaction`'s army as an Allied Detachment. */
export function getAllyFactions(primaryFaction: string) {
  if (!FACTION_BY_ID[primaryFaction]?.canTakeAllies) return [];
  const allied = getChartDetachment(ALLIED_CHART, ALLIED_DETACHMENT);
  return FACTIONS.filter((f) => f.id !== primaryFaction && allied.sources?.includes(f.id));
}

/**
 * Additional detachments a force may add from its own chart without an unlock
 * (e.g. Knight Households' Armiger Talon). Limits come with the rules evaluator.
 */
export function getAdditionalDetachments(chartName: string, faction: string): DetachmentDef[] {
  return getChart(chartName).detachments.filter(
    (d) => d.type === 'additional' && (!d.sources?.length || d.sources.includes(faction))
  );
}

/**
 * The unit as placed via one of its alternate root links (e.g. Centurion as
 * "Command - Centurions Only"): same unit, that link's id and category.
 */
export function unitVariant(
  unit: UnitEntry,
  link: { entryId: string; category: string; categoryIds?: string[] }
): UnitEntry {
  // Every .ros path in the unit starts at its root link — re-root them on the alternate link
  const reroot = (path: string | undefined) =>
    path && unit.entryId && path.startsWith(`${unit.entryId}::`) ? `${link.entryId}${path.slice(unit.entryId.length)}` : path;
  const rerootWargear = (w: WargearEntry): WargearEntry => ({
    ...w,
    path: reroot(w.path),
    groupPath: reroot(w.groupPath),
    children: w.children?.map(rerootWargear),
  });
  const rerootModel = (m: ModelEntry): ModelEntry => ({
    ...m,
    path: reroot(m.path),
    models: m.models?.map(rerootModel),
    defaultWargear: m.defaultWargear.map(rerootWargear),
  });
  return {
    ...unit,
    entryId: link.entryId,
    path: reroot(unit.path),
    models: unit.models.map(rerootModel),
    unitWargear: unit.unitWargear?.map(rerootWargear),
    prime: unit.prime && {
      ...unit.prime,
      path: reroot(unit.prime.path),
      groupPrefixes:
        unit.prime.groupPrefixes &&
        Object.fromEntries(Object.entries(unit.prime.groupPrefixes).map(([k, v]) => [k, reroot(v) ?? v])),
    },
    detachmentChoice: unit.detachmentChoice && {
      ...unit.detachmentChoice,
      prefix: reroot(unit.detachmentChoice.prefix) ?? unit.detachmentChoice.prefix,
    },
    primaryCategory: link.category,
    role: getBaseRole(link.category),
    primaryCategoryRules: undefined,
    // The link's own categories replace the main link's (a Centurion fielded as
    // "Command - Centurions Only" isn't in the Command category)
    facts: variantFacts(unit, link),
  };
}

function variantFacts(unit: UnitEntry, link: { entryId: string; categoryIds?: string[] }): UnitEntry['facts'] {
  if (!unit.facts) return unit.facts;
  const facts = { ...unit.facts };
  const drop = (id: string | undefined) => {
    if (id && facts[id] !== undefined) {
      facts[id] -= 1;
      if (facts[id] <= 0) delete facts[id];
    }
  };
  drop(unit.entryId);
  for (const id of unit.linkCategoryIds ?? []) drop(id);
  for (const id of [link.entryId, ...(link.categoryIds ?? [])]) facts[id] = (facts[id] ?? 0) + 1;
  return facts;
}

/** Strips " - qualifier" suffix: "Command - Centurions Only" → "Command" */
export function getBaseRole(qualifiedRole: string): string {
  const idx = qualifiedRole.indexOf(' - ');
  return idx !== -1 ? qualifiedRole.slice(0, idx) : qualifiedRole;
}

/** Strips "Prime " prefix: "Prime Command" → "Command" */
export function stripPrimePrefix(role: string): string {
  return role.startsWith('Prime ') ? role.slice(6) : role;
}

/**
 * Returns the matchable base role for a slot — strips both the "Prime " prefix
 * and any " - qualifier" suffix. Used to filter units for a given slot.
 */
export function getMatchableRole(slotRole: string): string {
  return getBaseRole(stripPrimePrefix(slotRole));
}

/**
 * Returns detachments of a given type available to the specified faction.
 * If no faction is provided, or sources list is empty (unknown), includes all.
 */
export function getDetachmentsForFaction(
  type: 'auxiliary' | 'apex',
  faction: string
): DetachmentDef[] {
  const all = detachmentsData[type] ?? [];
  return all.filter((d) => !d.sources || d.sources.length === 0 || d.sources.includes(faction));
}

/** Strips the "Auxiliary - ", "Apex - " or "Additional - " type prefix for display. */
export function getDetachmentDisplayName(name: string): string {
  return name.replace(/^(Auxiliary|Apex|Additional) [-–] /, '').trim() || name;
}
