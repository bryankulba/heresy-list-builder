import unitsJson from '../../data/parsed/units.json';
import detachmentsJson from '../../data/parsed/detachments.json';
import systemJson from '../../data/parsed/system.json';
import cataloguesJson from '../../data/parsed/catalogues.json';
import type { UnitEntry, DetachmentDef } from '../types';
import { SM_LEGION_KEYS } from './factions';

export const unitsData = unitsJson as Record<string, UnitEntry[]>;

export interface SystemInfo {
  gameSystemId: string;
  gameSystemName: string;
  revision: number;
  forceOrgEntryId: string;
}

export interface CatalogueInfo {
  catalogueId: string;
  catalogueName: string;
  revision: number;
}

export const systemData = systemJson as SystemInfo;
export const cataloguesData = cataloguesJson as Record<string, CatalogueInfo>;

export const detachmentsData = detachmentsJson as {
  core: DetachmentDef[];
  auxiliary: DetachmentDef[];
  apex: DetachmentDef[];
  legion: Record<string, DetachmentDef[]>;
};

/** Returns all units available to a faction: LA base (SM legions only) + faction-specific. */
export function getUnitsForFaction(faction: string): UnitEntry[] {
  const specific = unitsData[faction] ?? [];
  if (SM_LEGION_KEYS.has(faction)) {
    return [...(unitsData['legiones-astartes'] ?? []), ...specific];
  }
  return specific;
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

/** Returns units valid for a given slot role + faction. */
export function getUnitsForRole(faction: string, slotRole: string): UnitEntry[] {
  const matchable = getMatchableRole(slotRole);
  return getUnitsForFaction(faction).filter((u) => u.role === matchable);
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

/** Strips the "Auxiliary - " or "Apex - " type prefix for display. */
export function getDetachmentDisplayName(name: string): string {
  if (name.startsWith('Auxiliary - ') || name.startsWith('Auxiliary – ')) {
    return name.slice(name.indexOf(' - ') + 3) || name.slice(name.indexOf(' – ') + 3);
  }
  if (name.startsWith('Apex - ') || name.startsWith('Apex – ')) {
    return name.slice(name.indexOf(' - ') + 3) || name.slice(name.indexOf(' – ') + 3);
  }
  return name;
}
