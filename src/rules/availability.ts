/**
 * availability.ts
 * Units BSData won't field for the roster's allegiance — e.g. Sevatar is hidden
 * once the roster is Loyalist. A unit counts as allegiance-locked only when it's
 * hidden under this allegiance and shown under the other, so units hidden for
 * reasons the builder doesn't model (a Rite of War, a chosen upgrade) are left
 * alone.
 */

import type { Allegiance, Force, PlacedDetachment, UnitEntry } from '../types';
import { effectiveHidden } from './evaluate';
import { rosterCounts, unitContext, type RosterCounts } from './context';

const OTHER: Record<Allegiance, Allegiance> = { Loyalist: 'Traitor', Traitor: 'Loyalist' };

function hiddenWith(forces: Force[], force: Force, det: PlacedDetachment, unit: UnitEntry, counts: RosterCounts): boolean {
  return effectiveHidden(unit.hidden ?? false, unit.visibility, unitContext(forces, force, det, unit, undefined, counts));
}

/** Roster counts under each allegiance, for repeated checks. */
export function allegianceCounts(forces: Force[], allegiance: Allegiance) {
  return { own: rosterCounts(forces, { allegiance }), other: rosterCounts(forces, { allegiance: OTHER[allegiance] }) };
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
