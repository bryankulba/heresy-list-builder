import unitsJson from '../../data/parsed/units.json';
import detachmentsJson from '../../data/parsed/detachments.json';
import systemJson from '../../data/parsed/system.json';
import cataloguesJson from '../../data/parsed/catalogues.json';
import rulesJson from '../../data/parsed/rules.json';
import type { UnitEntry, DetachmentDef } from '../types';
import type { PrimeNode } from '../rules/primeBenefits';
import { ALLIED_CHART, ALLIED_DETACHMENT, CRUSADE_CHART, FACTIONS, FACTION_BY_ID } from './factions';

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
export const rulesData = rulesJson as unknown as {
  primeGroups: Record<string, PrimeNode>;
  detachmentChoice: { apex?: { id: string; name: string }; auxiliary?: { id: string; name: string } };
};
export const cataloguesData = cataloguesJson as Record<string, CatalogueInfo>;

/** A root force entry and the detachments it may contain (mirrors a .ros root <force>). */
export interface ForceChartDef {
  id: string;
  name: string;
  catalogue: string | null;
  detachments: DetachmentDef[];
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
export function unitVariant(unit: UnitEntry, link: { entryId: string; category: string }): UnitEntry {
  return {
    ...unit,
    entryId: link.entryId,
    primaryCategory: link.category,
    role: getBaseRole(link.category),
    primaryCategoryRules: undefined,
  };
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
