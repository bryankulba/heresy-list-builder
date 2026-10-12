/**
 * context.ts
 * Builds RuleContexts (see evaluate.ts) from the roster.
 */

import type { Force, PlacedDetachment, UnitEntry } from '../types';
import { cataloguesData, getChart } from '../data/loader';
import type { RuleContext } from './evaluate';

type Counts = Record<string, number>;

function addCounts(into: Counts, from: Counts | undefined, times = 1): void {
  for (const [id, n] of Object.entries(from ?? {})) into[id] = (into[id] ?? 0) + n * times;
}

/** Ids a placed unit contributes: its facts, plus its chosen Prime benefit. */
function slotCounts(unit: UnitEntry, primeBenefitId?: string): Counts {
  const counts: Counts = { ...(unit.facts ?? {}) };
  if (primeBenefitId) counts[primeBenefitId] = (counts[primeBenefitId] ?? 0) + 1;
  return counts;
}

function detachmentCounts(det: PlacedDetachment): Counts {
  const counts: Counts = {};
  for (const fs of Object.values(det.slots)) {
    if (fs) addCounts(counts, slotCounts(fs.unit, fs.primeBenefit?.id));
  }
  for (const bs of det.bonusSlots ?? []) {
    if (bs.unit) addCounts(counts, slotCounts(bs.unit));
  }
  return counts;
}

export interface RosterCounts {
  roster: Counts;
  rosterForces: Counts;
  byDetachment: Map<string, Counts>;
}

export function rosterCounts(forces: Force[]): RosterCounts {
  const roster: Counts = {};
  const rosterForces: Counts = {};
  const byDetachment = new Map<string, Counts>();
  for (const force of forces) {
    const chartId = getChart(force.chart).id;
    rosterForces[chartId] = (rosterForces[chartId] ?? 0) + 1;
    for (const det of force.detachments) {
      if (det.def.entryId) rosterForces[det.def.entryId] = (rosterForces[det.def.entryId] ?? 0) + 1;
      const counts = detachmentCounts(det);
      byDetachment.set(det.id, counts);
      addCounts(roster, counts);
    }
  }
  return { roster, rosterForces, byDetachment };
}

/**
 * Context for something inside `unit` placed in `detachment` of `force`
 * (e.g. the unit's Prime benefits). `slotCategoryId` is the category of the
 * slot it fills, which counts as one of the unit's categories.
 */
export function unitContext(
  forces: Force[],
  force: Force,
  detachment: PlacedDetachment,
  unit: UnitEntry,
  slotCategoryId?: string,
  counts: RosterCounts = rosterCounts(forces)
): RuleContext {
  const unitCounts: Counts = { ...(unit.facts ?? {}) };
  if (slotCategoryId) unitCounts[slotCategoryId] = (unitCounts[slotCategoryId] ?? 0) + 1;
  return {
    catalogueId: cataloguesData[force.faction]?.catalogueId ?? '',
    forceEntryIds: [detachment.def.entryId ?? '', getChart(force.chart).id].filter(Boolean),
    unit: unitCounts,
    force: counts.byDetachment.get(detachment.id) ?? {},
    roster: counts.roster,
    rosterForces: counts.rosterForces,
  };
}
