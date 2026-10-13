/**
 * detachmentLimits.ts
 * How many Auxiliary / Apex detachments an army may take, straight from BSData:
 * each detachment "costs" 1 of a cost type ("Auxiliary Detachment(s)") and the
 * chart caps that cost, raised by modifiers per selection in the army — +1 per
 * Command unit, +1 more per Officer of the Line (2), +1 per High Command "One
 * Auxiliary Detachment" choice, −1 for Special Assignment…
 */

import type { Force } from '../types';
import { cataloguesData, getChart } from '../data/loader';
import { applyNumericModifiers, type RuleContext } from './evaluate';
import { rosterCounts, type RosterCounts } from './context';

export interface DetachmentAllowance {
  costTypeId: string;
  /** e.g. "Auxiliary Detachment(s)" */
  name: string;
  used: number;
  max: number;
}

/** Selections across the whole army (the chart's scope "force" includes its child forces). */
function armyContext(forces: Force[], force: Force, counts: RosterCounts): RuleContext {
  const army: Record<string, number> = {};
  for (const det of force.detachments) {
    for (const [id, n] of Object.entries(counts.byDetachment.get(det.id) ?? {})) army[id] = (army[id] ?? 0) + n;
  }
  return {
    catalogueId: cataloguesData[force.faction]?.catalogueId ?? '',
    forceEntryIds: [getChart(force.chart).id],
    unit: {},
    force: army,
    roster: counts.roster,
    rosterForces: counts.rosterForces,
    level: 'detachment',
  };
}

/** Each detachment limit of the army's chart, with what the army uses of it. */
export function detachmentAllowances(
  forces: Force[],
  force: Force,
  counts: RosterCounts = rosterCounts(forces)
): DetachmentAllowance[] {
  const ctx = armyContext(forces, force, counts);
  return (getChart(force.chart).limits ?? []).map((limit) => ({
    costTypeId: limit.costTypeId,
    name: limit.name,
    max: applyNumericModifiers(limit.max, limit.modifiers, ctx),
    used: force.detachments.reduce((n, d) => n + (d.def.costs?.[limit.costTypeId] ?? 0), 0),
  }));
}

/** The allowance for detachments of a type ('auxiliary' | 'apex'), if the chart limits them. */
export function allowanceFor(
  forces: Force[],
  force: Force,
  type: 'auxiliary' | 'apex',
  counts?: RosterCounts
): DetachmentAllowance | undefined {
  const costs = getChart(force.chart).detachments.find((d) => d.type === type && d.costs)?.costs;
  const id = costs ? Object.keys(costs)[0] : undefined;
  return detachmentAllowances(forces, force, counts).find((a) => a.costTypeId === id);
}

/**
 * How many Auxiliary detachments a slot's unit adds to its army's allowance:
 * the allowance with the roster as is, minus the allowance without that unit
 * (e.g. 2 for a Centurion as Command, 1 for one in a "Centurions Only" slot).
 */
export function auxiliaryUnlocks(forces: Force[], detachmentId: string, slotKey: string): number {
  const force = forces.find((f) => f.detachments.some((d) => d.id === detachmentId));
  if (!force) return 0;
  const withoutForce: Force = {
    ...force,
    detachments: force.detachments.map((d) => (d.id !== detachmentId ? d : { ...d, slots: { ...d.slots, [slotKey]: null } })),
  };
  const without = forces.map((f) => (f === force ? withoutForce : f));
  const withMax = allowanceFor(forces, force, 'auxiliary')?.max ?? 0;
  const withoutMax = allowanceFor(without, withoutForce, 'auxiliary')?.max ?? 0;
  return Math.max(0, withMax - withoutMax);
}
