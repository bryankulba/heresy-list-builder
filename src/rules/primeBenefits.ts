/**
 * primeBenefits.ts
 * The Prime benefits a unit may take in a given slot, straight from BSData:
 * each unit links its catalogue's benefit tree, and every benefit's
 * visibility is a BSData condition evaluated against the unit's context.
 */

import type { Force, PrimeBenefit, UnitEntry } from '../types';
import { rulesData } from '../data/loader';
import { effectiveHidden, type RuleContext, type RuleModifier } from './evaluate';

export interface PrimeNode {
  id: string;
  name: string;
  kind: 'group' | 'option';
  /** Ids it also puts in the roster when chosen (its link target, categories) */
  counts?: string[];
  /** Options: .ros path relative to the unit's group prefix (UnitEntry.prime.groupPrefixes) */
  path?: string;
  groupPath?: string;
  hidden?: boolean;
  modifiers?: RuleModifier[];
  description?: string;
  /** Options: how many the roster / one detachment may hold (Seneschal: 1 per roster) */
  max?: { roster?: number; force?: number };
  children?: PrimeNode[];
}

export interface PrimeOption extends PrimeBenefit {
  /** Further choices made after picking this benefit (e.g. Logistical Benefit's slot role) */
  subChoices: PrimeOption[];
  /** How many the roster / one detachment may hold */
  max?: PrimeNode['max'];
}

/** Visible options under a node (descending through visible groups). */
function visibleOptions(nodes: PrimeNode[] | undefined, ctx: RuleContext): PrimeOption[] {
  const out: PrimeOption[] = [];
  for (const node of nodes ?? []) {
    if (effectiveHidden(node.hidden ?? false, node.modifiers, ctx)) continue;
    if (node.kind === 'group') {
      out.push(...visibleOptions(node.children, ctx));
    } else {
      out.push({
        id: node.id,
        name: node.name,
        description: node.description ?? '',
        subChoices: visibleOptions(node.children, ctx),
        ...(node.max ? { max: node.max } : {}),
      });
    }
  }
  return out;
}

/** The Prime benefits `unit` may choose, in the context of the slot it fills. */
export function getPrimeOptions(unit: UnitEntry, ctx: RuleContext): PrimeOption[] {
  const groups = (unit.prime?.groups ?? []).map((id) => rulesData.primeGroups[id]).filter(Boolean);
  const seen = new Set<string>();
  return groups
    .flatMap((g) => visibleOptions(g.children, ctx))
    .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

function searchOptions(nodes: PrimeNode[] | undefined, match: (n: PrimeNode) => boolean): PrimeNode | undefined {
  for (const n of nodes ?? []) {
    if (n.kind === 'option' && match(n)) return n;
    const found = searchOptions(n.children, match);
    if (found) return found;
  }
  return undefined;
}

/**
 * Finds a benefit in the unit's trees, by id (or by name for benefits saved
 * before ids came from data), with the unit's path prefix for that tree.
 */
export function findPrimeNodeInGroups(
  unit: UnitEntry,
  benefit: PrimeBenefit
): { node: PrimeNode; prefix: string } | undefined {
  const matchers = [
    (n: PrimeNode) => n.id === benefit.id,
    (n: PrimeNode) => n.name.toLowerCase() === benefit.name.toLowerCase(),
  ];
  for (const match of matchers) {
    for (const groupId of unit.prime?.groups ?? []) {
      const node = searchOptions(rulesData.primeGroups[groupId]?.children, match);
      if (node) return { node, prefix: unit.prime?.groupPrefixes?.[groupId] ?? '' };
    }
  }
  return undefined;
}

/** Finds a benefit node anywhere in the unit's trees. */
export function findPrimeNode(unit: UnitEntry, benefit: PrimeBenefit): PrimeNode | undefined {
  return findPrimeNodeInGroups(unit, benefit)?.node;
}

/** Logistical Benefit adds a bonus slot whose role is picked from its sub-choices ("LB - Armour"…). */
export function isLogisticalBenefit(benefit: PrimeBenefit): boolean {
  return /^Logistical Benefit/i.test(benefit.name);
}

const LB_PREFIX = /^LB - /;

/** Bonus slot roles offered by a Logistical Benefit option. */
export function logisticalBenefitRoles(option: PrimeOption | undefined): string[] {
  return (option?.subChoices ?? []).filter((c) => LB_PREFIX.test(c.name)).map((c) => c.name.replace(LB_PREFIX, ''));
}

/** The "LB - <role>" sub-choice of a unit's Logistical Benefit, for export. */
export function logisticalBenefitChoice(unit: UnitEntry, benefit: PrimeBenefit, role: string): PrimeNode | undefined {
  const node = findPrimeNode(unit, benefit);
  const search = (nodes: PrimeNode[] | undefined): PrimeNode | undefined => {
    for (const n of nodes ?? []) {
      if (n.kind === 'option' && n.name === `LB - ${role}`) return n;
      const found = search(n.children);
      if (found) return found;
    }
    return undefined;
  };
  return search(node?.children);
}

/** How many slots hold this benefit, in the roster and in one detachment (leaving out one slot, e.g. the one being edited). */
function benefitCounts(forces: Force[], benefitId: string, detachmentId: string, except?: string) {
  let roster = 0;
  let force = 0;
  for (const det of forces.flatMap((f) => f.detachments)) {
    for (const [key, fs] of Object.entries(det.slots)) {
      if (fs?.primeBenefit?.id !== benefitId || (det.id === detachmentId && key === except)) continue;
      roster += 1;
      if (det.id === detachmentId) force += 1;
    }
  }
  return { roster, force };
}

/**
 * Whether the benefit's BSData limit is already used up elsewhere — Seneschal
 * once per roster, Master Sergeant once per detachment — so a slot can't take it.
 */
export function benefitLimitReached(
  forces: Force[],
  option: Pick<PrimeOption, 'id' | 'max'>,
  detachmentId: string,
  slotKey: string
): boolean {
  if (!option.max) return false;
  const n = benefitCounts(forces, option.id, detachmentId, slotKey);
  return (option.max.roster !== undefined && n.roster >= option.max.roster) || (option.max.force !== undefined && n.force >= option.max.force);
}

/** Benefits held more often than BSData allows: the slots past the limit, with the limit. */
export function benefitLimitBreaches(forces: Force[]): Array<{ detachmentId: string; slotKey: string; name: string; scope: 'roster' | 'force'; max: number }> {
  const out: Array<{ detachmentId: string; slotKey: string; name: string; scope: 'roster' | 'force'; max: number }> = [];
  const rosterSeen = new Map<string, number>();
  for (const det of forces.flatMap((f) => f.detachments)) {
    const forceSeen = new Map<string, number>();
    for (const [slotKey, fs] of Object.entries(det.slots)) {
      const benefit = fs?.primeBenefit;
      const max = benefit && fs ? findPrimeNode(fs.unit, benefit)?.max : undefined;
      if (!benefit || !max) continue;
      const r = (rosterSeen.get(benefit.id) ?? 0) + 1;
      const f = (forceSeen.get(benefit.id) ?? 0) + 1;
      rosterSeen.set(benefit.id, r);
      forceSeen.set(benefit.id, f);
      if (max.roster !== undefined && r > max.roster) out.push({ detachmentId: det.id, slotKey, name: benefit.name, scope: 'roster', max: max.roster });
      else if (max.force !== undefined && f > max.force) out.push({ detachmentId: det.id, slotKey, name: benefit.name, scope: 'force', max: max.force });
    }
  }
  return out;
}
