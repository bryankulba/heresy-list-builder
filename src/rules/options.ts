/**
 * options.ts
 * Which choices to offer: only what the army can actually use. A detachment
 * no unit of the army can fill, or one only its configuration could unlock
 * (another allegiance, doctrine or catalogue), isn't offered; one a unit would
 * unlock is offered with BSData's reason ("requires a Siege Breaker").
 */

import type { DetachmentDef, Force, PlacedDetachment, SlotDef } from '../types';
import { cataloguesData, getChart, getUnitsForFaction, rulesData } from '../data/loader';
import { conditionsHold, type RuleCondition, type RuleConditionGroup, type RuleContext } from './evaluate';
import { rosterCounts, type RosterCounts } from './context';
import { allowanceFor, isDetachmentLocked } from './detachmentLimits';
import { unitsForSlot } from './slots';
import type { PrimeNode } from './primeBenefits';

export type DetachmentAvailability = { status: 'ok' } | { status: 'locked'; reason?: string } | { status: 'hidden' };

/** Everything a unit of this army could bring to the roster: its facts, Prime benefits, detachment choices. */
const obtainableCache = new Map<string, Set<string>>();
function obtainableIds(faction: string): Set<string> {
  const cached = obtainableCache.get(faction);
  if (cached) return cached;
  const ids = new Set<string>();
  const addTree = (nodes: PrimeNode[] | undefined) => {
    for (const n of nodes ?? []) {
      ids.add(n.id);
      addTree(n.children);
    }
  };
  for (const u of getUnitsForFaction(faction)) {
    for (const id of Object.keys(u.facts ?? {})) ids.add(id);
    for (const g of u.prime?.groups ?? []) addTree(rulesData.primeGroups[g]?.children);
  }
  for (const choice of Object.values(rulesData.detachmentChoice)) {
    for (const id of [choice?.id, ...(choice?.categoryIds ?? [])]) if (id) ids.add(id);
  }
  obtainableCache.set(faction, ids);
  return ids;
}

/** Ids a set of conditions / repeats depends on. */
function referencedIds(holders: Array<{ conditions?: RuleCondition[]; conditionGroups?: RuleConditionGroup[]; repeats?: Array<{ childId?: string }> }>): string[] {
  const out: string[] = [];
  const walk = (h: { conditions?: RuleCondition[]; conditionGroups?: RuleConditionGroup[] }) => {
    for (const c of h.conditions ?? []) if (c.childId) out.push(c.childId);
    for (const g of h.conditionGroups ?? []) walk(g);
  };
  for (const h of holders) {
    walk(h);
    for (const r of h.repeats ?? []) if (r.childId) out.push(r.childId);
  }
  return out;
}

function armyContext(force: Force, counts: RosterCounts): RuleContext {
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

/** Whether any unit of the army could fill a slot of this role in this detachment. */
export function slotHasUnits(forces: Force[], force: Force, det: PlacedDetachment, slot: SlotDef, counts: RosterCounts): boolean {
  return unitsForSlot(forces, force, det, slot, counts).length > 0;
}

/** Should the detachment picker offer this detachment, and how? */
export function detachmentAvailability(
  forces: Force[],
  force: Force,
  def: DetachmentDef,
  counts: RosterCounts = rosterCounts(forces)
): DetachmentAvailability {
  // Nothing in the army can fill it (e.g. Daemon Brutes only, Araknae only)
  const probe: PlacedDetachment = { id: '__probe__', def, slots: {} };
  if (!def.slots.some((s) => s.max > 0 && slotHasUnits(forces, force, probe, s, counts))) return { status: 'hidden' };

  if (!isDetachmentLocked(forces, force, def, counts)) return { status: 'ok' };

  // Locked: offer it only if a unit could unlock it (what its cap or errors depend on)
  // (its own cap and errors, and chart limits other than the Auxiliary/Apex count the unlock itself provides)
  const ownType = allowanceFor(forces, force, def.type === 'apex' ? 'apex' : 'auxiliary', counts)?.costTypeId;
  const limitMods =
    getChart(force.chart).limits?.flatMap((l) =>
      l.costTypeId !== ownType && (def.costs?.[l.costTypeId] ?? 0) > 0 ? l.modifiers : []
    ) ?? [];
  // (errors aren't unlocks — they also carry unrelated checks — but supply the reason below)
  const deps = referencedIds([...(def.rosterMax?.modifiers ?? []), ...limitMods]);
  const obtainable = obtainableIds(force.faction);
  if (!deps.some((id) => obtainable.has(id))) return { status: 'hidden' };
  const ctx = armyContext(force, counts);
  const message = def.errors?.find((e) => conditionsHold(e, ctx))?.message;
  if (message) return { status: 'locked', reason: message };
  // No BSData message: name the army's units (or Prime benefits) that would unlock it
  const units = getUnitsForFaction(force.faction);
  const benefits: string[] = [];
  const findBenefits = (nodes: PrimeNode[] | undefined) => {
    for (const n of nodes ?? []) {
      if (n.kind === 'option' && deps.includes(n.id)) benefits.push(`the ${n.name} Prime benefit`);
      findBenefits(n.children);
    }
  };
  for (const g of new Set(units.flatMap((u) => u.prime?.groups ?? []))) findBenefits(rulesData.primeGroups[g]?.children);
  const unlockers = [
    ...new Set([...units.filter((u) => deps.some((id) => u.facts?.[id])).map((u) => u.name), ...benefits]),
  ];
  return {
    status: 'locked',
    ...(unlockers.length > 0
      ? { reason: `Unlocked by ${unlockers.slice(0, 3).join(' or ')}${unlockers.length > 3 ? '…' : ''}` }
      : {}),
  };
}

/**
 * The detachment's slots without roles no unit of the army can fill (e.g.
 * Skitarii Transport), keeping required and filled ones. Prime and regular
 * slots of a role go together so slot keys stay stable.
 */
export function fillableSlots(forces: Force[], force: Force, det: PlacedDetachment, counts: RosterCounts): SlotDef[] {
  const base = (role: string) => role.replace(/^Prime /, '');
  const filledRoles = new Set(
    Object.entries(det.slots)
      .filter(([, fs]) => fs)
      .map(([key]) => base(key.slice(0, key.lastIndexOf('-'))))
  );
  const keep = new Map<string, boolean>();
  for (const s of det.def.slots) {
    const role = base(s.role);
    if (keep.get(role)) continue;
    keep.set(
      role,
      s.min > 0 || filledRoles.has(role) || s.max <= 0 || slotHasUnits(forces, force, det, { ...s, role, prime: false }, counts)
    );
  }
  return det.def.slots.filter((s) => keep.get(base(s.role)));
}

