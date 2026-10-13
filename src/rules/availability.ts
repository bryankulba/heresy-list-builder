/**
 * availability.ts
 * Units BSData won't field for the roster's allegiance — e.g. Sevatar is hidden
 * once the roster is Loyalist. A unit counts as allegiance-locked only when it's
 * hidden under this allegiance and shown under the other, so units hidden for
 * reasons the builder doesn't model (a Rite of War, a chosen upgrade) are left
 * alone.
 */

import type { Allegiance, Force, PlacedDetachment, UnitEntry } from '../types';
import { getChart } from '../data/loader';
import { effectiveHidden } from './evaluate';
import { rosterCounts, unitContext, type RosterCounts } from './context';

const OTHER: Record<Allegiance, Allegiance> = { Loyalist: 'Traitor', Traitor: 'Loyalist' };

/**
 * Slots offered regardless of allegiance: the Warlord slot takes any of the
 * Legion's Primarchs — a Traitor Leman Russ against a Loyalist Horus is a
 * game people play. (Still a warning, as New Recruit flags it.)
 */
export function ignoresAllegiance(slotRole: string): boolean {
  return slotRole.replace(/^Prime /, '').split(' - ')[0] === 'Warlord';
}

function hiddenWith(forces: Force[], force: Force, det: PlacedDetachment, unit: UnitEntry, counts: RosterCounts): boolean {
  return effectiveHidden(unit.hidden ?? false, unit.visibility, unitContext(forces, force, det, unit, undefined, counts));
}

const countsCache = new WeakMap<Force[], Partial<Record<Allegiance, { own: RosterCounts; other: RosterCounts }>>>();

/** Roster counts under each allegiance, for repeated checks (cached per forces array). */
export function allegianceCounts(forces: Force[], allegiance: Allegiance) {
  const cached = countsCache.get(forces) ?? {};
  if (!cached[allegiance]) {
    cached[allegiance] = { own: rosterCounts(forces, { allegiance }), other: rosterCounts(forces, { allegiance: OTHER[allegiance] }) };
    countsCache.set(forces, cached);
  }
  return cached[allegiance]!;
}

export function isAllegianceLocked(
  forces: Force[],
  force: Force,
  det: PlacedDetachment,
  unit: UnitEntry,
  counts: { own: RosterCounts; other: RosterCounts }
): boolean {
  if (!unit.visibility?.length) return false;
  return hiddenWith(forces, force, det, unit, counts.own) && !hiddenWith(forces, force, det, unit, counts.other);
}

/**
 * Units a force's chart forbids outright: BSData chart errors raised by a
 * single "roster has at least one <category>" condition — e.g. Zone Mortalis'
 * "Flyers and Vehicles with 3 hull points or more are not allowed", keyed on
 * the "Invalid ZM Vehicle" category such units carry. Returns that error's
 * message for the unit, if any.
 */
export function chartBan(force: Force, unit: UnitEntry): string | undefined {
  for (const error of getChart(force.chart).errors ?? []) {
    const [c, ...rest] = error.conditions ?? [];
    if (!c || rest.length > 0 || error.conditionGroups?.length) continue;
    if (c.type !== 'atLeast' || c.value !== 1 || c.field !== 'selections' || !c.childId) continue;
    if ((unit.facts?.[c.childId] ?? 0) > 0) return error.message;
  }
  return undefined;
}
