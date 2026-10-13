/**
 * detachmentLimits.ts
 * How many Auxiliary / Apex detachments an army may take, straight from BSData:
 * each detachment "costs" 1 of a cost type ("Auxiliary Detachment(s)") and the
 * chart caps that cost, raised by modifiers per selection in the army — +1 per
 * Command unit, +1 more per Officer of the Line (2), +1 per High Command "One
 * Auxiliary Detachment" choice, −1 for Special Assignment…
 */

import type { DetachmentDef, Force } from '../types';
import { cataloguesData, getChart } from '../data/loader';
import { applyNumericModifiers, type RuleContext } from './evaluate';
import { rosterCounts, type RosterCounts } from './context';
import { detachmentPoints } from '../store/rosterModel';

const POINTS_TYPE_ID = '9893-c379-920b-8982';

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
    rosterCosts: counts.rosterCosts,
    pointsLimit: counts.pointsLimit,
    level: 'detachment',
  };
}

/** What a detachment uses of a limit, after its cost modifiers (a Tercio with its doctrine: 0.5). */
function detachmentCost(def: DetachmentDef, costTypeId: string, ctx: RuleContext): number {
  const base = def.costs?.[costTypeId] ?? 0;
  const mods = def.costModifiers?.[costTypeId];
  return mods ? applyNumericModifiers(base, mods, ctx) : base;
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
    // Points (a Lord of War Detachment's share of the army) or detachments used
    used:
      limit.costTypeId === POINTS_TYPE_ID
        ? force.detachments.reduce((n, d) => n + detachmentPoints(d), 0)
        : force.detachments.reduce((n, d) => n + detachmentCost(d.def, limit.costTypeId, ctx), 0),
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

/** Detachments taken more often than BSData allows them in the roster (e.g. Knight Additional detachments). */
export function detachmentCaps(
  forces: Force[],
  counts: RosterCounts = rosterCounts(forces)
): Array<{ name: string; force: Force; used: number; max: number }> {
  const out: Array<{ name: string; force: Force; used: number; max: number }> = [];
  const seen = new Set<string>();
  for (const force of forces) {
    const ctx = armyContext(forces, force, counts);
    for (const det of force.detachments) {
      const cap = det.def.rosterMax;
      const key = det.def.entryId ?? det.def.name;
      if (!cap || seen.has(key)) continue;
      seen.add(key);
      const used = forces.flatMap((f) => f.detachments).filter((d) => (d.def.entryId ?? d.def.name) === key).length;
      out.push({ name: det.def.name, force, used, max: applyNumericModifiers(cap.max, cap.modifiers, ctx) });
    }
  }
  return out;
}

/**
 * Whether the army hasn't unlocked a detachment it could add: its roster cap is
 * used up (a Storm Battery without a Siege Breaker) or it would go past another
 * of the chart's limits (a Tank Commander detachment without a Tank Commander).
 * The Auxiliary/Apex count itself is left to the unlock that offers the choice.
 */
export function isDetachmentLocked(
  forces: Force[],
  force: Force,
  def: DetachmentDef,
  counts: RosterCounts = rosterCounts(forces)
): boolean {
  const key = def.entryId ?? def.name;
  if (def.rosterMax) {
    const used = forces.flatMap((f) => f.detachments).filter((d) => (d.def.entryId ?? d.def.name) === key).length;
    if (used + 1 > applyNumericModifiers(def.rosterMax.max, def.rosterMax.modifiers, armyContext(forces, force, counts))) {
      return true;
    }
  }
  const ownType = allowanceFor(forces, force, def.type === 'apex' ? 'apex' : 'auxiliary', counts)?.costTypeId;
  return detachmentAllowances(forces, force, counts).some(
    (a) => a.costTypeId !== ownType && (def.costs?.[a.costTypeId] ?? 0) > 0 && a.used + (def.costs?.[a.costTypeId] ?? 0) > a.max
  );
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
