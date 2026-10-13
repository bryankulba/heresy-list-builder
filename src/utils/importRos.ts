/**
 * importRos.ts
 * Reads a BattleScribe / New Recruit .ros roster into the builder's roster
 * model, at force-org level: armies, detachments, units in slots, Prime
 * benefits (incl. Logistical Benefit roles), allegiance and cohort doctrine.
 * Unit options (wargear, model counts) aren't modelled by the builder and are
 * left behind — the export regenerates defaults.
 */

import { XMLParser } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';
import type { Allegiance, Force, PlacedDetachment, PrimeBenefit, RosterSnapshot, UnitEntry } from '../types';
import { cataloguesData, detachmentsData, getBaseRole, getUnitsForFaction, rulesData, unitVariant } from '../data/loader';
import { ALLIED_CHART, ALLIED_DETACHMENT, FACTION_BY_ID } from '../data/factions';
import { COHORT_DOCTRINES } from '../constants/cohortDoctrines';
import type { PrimeNode } from '../rules/primeBenefits';
import { categoryFitsSlot, withEffectiveSlots } from '../rules/slots';
import { cardSlots } from '../components/canvas/slotLayout';

export interface ImportResult {
  snapshot: RosterSnapshot;
  /** Things that couldn't be brought across (unsupported forces, unknown units…) */
  warnings: string[];
}

interface RosNode {
  name?: string;
  entryId?: string;
  entryGroupId?: string;
  type?: string;
  catalogueId?: string;
  selections?: { selection?: RosNode[] };
  forces?: { force?: RosNode[] };
  categories?: { category?: Array<{ name?: string; primary?: string }> };
  costs?: { cost?: Array<{ name?: string; value?: string }> };
  costLimits?: { costLimit?: Array<{ name?: string; value?: string }> };
}

const ARRAYS = new Set(['force', 'selection', 'category', 'cost', 'costLimit', 'profile', 'rule', 'characteristic']);

const children = (n: RosNode | undefined): RosNode[] => n?.selections?.selection ?? [];
const primaryCategory = (n: RosNode): string | undefined =>
  n.categories?.category?.find((c) => c.primary === 'true')?.name;

/** A unit parsed from the roster, before it's placed in a slot. */
interface PendingUnit {
  unit: UnitEntry;
  category: string;
  prime: boolean;
  benefit?: PrimeBenefit;
  lbRole?: string;
  unlocksApex: number;
  unlocksAuxiliary: number;
}

function findUnit(faction: string, entryId: string): UnitEntry | undefined {
  const units = getUnitsForFaction(faction);
  const byPath = units.find((u) => u.path === entryId);
  if (byPath) return byPath;
  for (const u of units) {
    for (const alt of u.alternateLinks ?? []) {
      const variant = unitVariant(u, alt);
      if (variant.path === entryId) return variant;
    }
  }
  const root = entryId.split('::')[0];
  return units.find((u) => u.entryId === root);
}

/** The Prime benefit a roster selection refers to, by its .ros path (or name). */
function findBenefit(unit: UnitEntry, sel: RosNode): PrimeBenefit | undefined {
  const search = (nodes: PrimeNode[] | undefined, match: (n: PrimeNode) => boolean): PrimeNode | undefined => {
    for (const n of nodes ?? []) {
      if (n.kind === 'option' && match(n)) return n;
      const found = search(n.children, match);
      if (found) return found;
    }
    return undefined;
  };
  for (const groupId of unit.prime?.groups ?? []) {
    const prefix = unit.prime?.groupPrefixes?.[groupId];
    const tree = rulesData.primeGroups[groupId]?.children;
    const node =
      search(tree, (n) => prefix !== undefined && `${prefix}::${n.path}` === sel.entryId) ??
      search(tree, (n) => n.name === sel.name);
    if (node) return { id: node.id, name: node.name, description: node.description ?? '' };
  }
  return undefined;
}

function pendingUnit(faction: string, sel: RosNode, warnings: string[]): PendingUnit | undefined {
  const unit = findUnit(faction, sel.entryId ?? '');
  if (!unit) {
    warnings.push(`Unknown unit "${sel.name}" — skipped`);
    return undefined;
  }
  const primeSel = children(sel).find((c) => c.name === 'Prime Unit');
  const benefitSel = children(primeSel)[0];
  const lbSel = children(benefitSel).find((c) => c.name?.startsWith('LB - '));
  const marks = children(sel).map((c) => c.name);
  return {
    unit,
    category: primaryCategory(sel) ?? unit.primaryCategory ?? unit.role,
    prime: Boolean(primeSel),
    benefit: benefitSel ? findBenefit(unit, benefitSel) : undefined,
    lbRole: lbSel?.name?.replace(/^LB - /, ''),
    unlocksApex: marks.filter((m) => m === rulesData.detachmentChoice.apex?.name).length,
    unlocksAuxiliary: marks.filter((m) => m === rulesData.detachmentChoice.auxiliary?.name).length,
  };
}

/** Puts a unit into the first free slot of the detachment that fits it, or a matching Logistical Benefit bonus slot. */
function place(forces: Force[], det: PlacedDetachment, p: PendingUnit, warnings: string[]): string | undefined {
  const view = withEffectiveSlots(forces).flatMap((f) => f.detachments).find((d) => d.id === det.id)!;
  const roles = view.def.slots.map((s) => s.role);
  const free = cardSlots(view).filter((s) => !det.slots[s.key] && categoryFitsSlot(p.category, s.slotDef.role, roles));
  // Prefer a slot of the same kind; a non-Prime unit may still sit in a Prime
  // position (it just doesn't take a benefit), as in New Recruit
  const slot = free.find((s) => s.slotDef.prime === p.prime) ?? free[0];
  if (slot) {
    const choices = [
      ...Array<'apex'>(p.unlocksApex).fill('apex'),
      ...Array<'auxiliary'>(p.unlocksAuxiliary).fill('auxiliary'),
    ];
    det.slots[slot.key] = {
      unit: p.unit,
      isPrime: p.prime,
      ...(p.benefit ? { primeBenefit: p.benefit } : {}),
      ...(p.unit.detachmentChoice ? { detachmentChoices: choices } : {}),
    };
    if (p.lbRole) det.bonusSlots = [...(det.bonusSlots ?? []), { id: uuidv4(), sourceSlotKey: slot.key, role: p.lbRole, unit: null }];
    return slot.key;
  }
  const bonus = det.bonusSlots?.find((b) => !b.unit && b.role === getBaseRole(p.category));
  if (bonus) {
    bonus.unit = p.unit;
    return undefined;
  }
  // No slot fits — keep the unit as overflow so it isn't lost (the card shows it)
  const key = `${p.category}-${Object.keys(det.slots).length + 100}`;
  det.slots[key] = { unit: p.unit };
  warnings.push(`"${p.unit.name}" didn't fit a slot in ${det.def.name}`);
  return key;
}

/** Links unlocked detachments to the High Command / Command slots that unlocked them. */
function linkUnlocks(force: Force, unlockers: Array<{ detId: string; key: string; p: PendingUnit }>): void {
  const capacity = unlockers.map((u) => ({
    ...u,
    hc: getBaseRole(u.p.category) === 'High Command',
    left: Math.max(1, u.p.unit.officerOfTheLine ?? 1, u.p.unlocksApex + u.p.unlocksAuxiliary),
    apex: u.p.unlocksApex,
  }));
  for (const det of force.detachments) {
    if (det.def.type !== 'apex' && det.def.type !== 'auxiliary') continue;
    const pick =
      det.def.type === 'apex'
        ? capacity.find((c) => c.left > 0 && c.hc && c.apex > 0) ?? capacity.find((c) => c.left > 0 && c.hc)
        : capacity.find((c) => c.left > 0 && !c.hc) ?? capacity.find((c) => c.left > 0 && c.hc && c.apex === 0) ??
          capacity.find((c) => c.left > 0);
    if (!pick) continue;
    pick.left--;
    if (det.def.type === 'apex' && pick.apex > 0) pick.apex--;
    det.unlockedBy = `${pick.detId}::${pick.key}`;
  }
}

/** Tallies a unit's picks from army-wide choice groups (sub-faction), by group id → option id. */
function countArmyChoices(n: RosNode, votes: Record<string, Record<string, number>>): void {
  for (const c of children(n)) {
    const groupId = c.entryGroupId?.split('::').pop();
    const option = groupId ? rulesData.armyChoices[groupId]?.options.find((o) => c.entryId?.endsWith(o.path)) : undefined;
    if (groupId && option) {
      votes[groupId] = votes[groupId] ?? {};
      votes[groupId][option.id] = (votes[groupId][option.id] ?? 0) + 1;
    }
    countArmyChoices(c, votes);
  }
}

export function importRos(xml: string): ImportResult {
  const warnings: string[] = [];
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: (name) => ARRAYS.has(name) });
  const roster = (parser.parse(xml) as { roster?: RosNode }).roster;
  if (!roster) throw new Error('Not a .ros roster file');

  const factionByCatalogue = new Map(Object.entries(cataloguesData).map(([key, c]) => [c.catalogueId, key]));
  let allegiance: Allegiance = 'Loyalist';
  let cohortDoctrine = '';
  const armyChoiceVotes: Record<string, Record<string, number>> = {};
  const forces: Force[] = [];

  for (const rootForce of roster.forces?.force ?? []) {
    const chart = detachmentsData.charts.find((c) => c.id === rootForce.entryId);
    const faction = factionByCatalogue.get(rootForce.catalogueId ?? '');
    if (!chart || !faction || !FACTION_BY_ID[faction]) {
      warnings.push(`"${rootForce.name}" (${faction ?? 'unknown catalogue'}) isn't supported yet — skipped`);
      continue;
    }
    const kind = chart.name === ALLIED_CHART ? 'allied' : /Lord of War/i.test(chart.name) ? 'lordOfWar' : 'primary';
    // A chart without child forces (Lord of War Detachment) holds its units itself
    const rootLevel = chart.detachments.length === 1 && chart.detachments[0].entryId === chart.id;

    // Army configuration
    for (const sel of children(rootForce)) {
      const choice = children(sel)[0]?.name ?? '';
      if (sel.name === 'Allegiance' && (choice === 'Loyalist' || choice === 'Traitor')) allegiance = choice;
      if (sel.name === 'Cohort Doctrine') {
        cohortDoctrine = COHORT_DOCTRINES.find((d) => `Cohort Doctrine: ${d.name}` === choice)?.id ?? cohortDoctrine;
      }
    }

    const force: Force = { id: uuidv4(), faction, kind, chart: chart.name, detachments: [] };
    forces.push(force);
    const pending: Array<{ det: PlacedDetachment; units: PendingUnit[] }> = [];
    for (const childForce of rootLevel ? [rootForce] : rootForce.forces?.force ?? []) {
      const def = chart.detachments.find((d) => d.entryId === childForce.entryId);
      if (!def) {
        warnings.push(`Detachment "${childForce.name}" isn't supported yet — skipped`);
        continue;
      }
      const det: PlacedDetachment = { id: uuidv4(), def, slots: {} };
      force.detachments.push(det);
      for (const s of children(childForce).filter((s) => s.type === 'unit')) countArmyChoices(s, armyChoiceVotes);
      const units = children(childForce)
        .filter((s) => s.type === 'unit')
        .map((s) => pendingUnit(faction, s, warnings))
        .filter((u): u is PendingUnit => u !== undefined);
      pending.push({ det, units });
    }

    // The army's root detachment (primary / allied) first, as the canvas expects
    const rootName =
      kind === 'allied' ? ALLIED_DETACHMENT : kind === 'lordOfWar' ? chart.detachments[0].name : FACTION_BY_ID[faction].primaryDetachment;
    force.detachments.sort((a, b) => Number(b.def.name === rootName) - Number(a.def.name === rootName));

    // Prime units first, so prime positions go to the units that are Prime
    const unlockers: Array<{ detId: string; key: string; p: PendingUnit }> = [];
    for (const { det, units } of pending) {
      for (const p of [...units.filter((u) => u.prime), ...units.filter((u) => !u.prime)]) {
        const key = place(forces, det, p, warnings);
        const base = getBaseRole(p.category);
        if (key && (base === 'High Command' || base === 'Command')) unlockers.push({ detId: det.id, key, p });
      }
    }
    linkUnlocks(force, unlockers);
  }

  const total = Number(roster.costs?.cost?.find((c) => c.name === 'Point(s)')?.value ?? 0);
  const limit = Number(roster.costLimits?.costLimit?.find((c) => c.name === 'Point(s)')?.value ?? 0);
  return {
    snapshot: {
      allegiance,
      pointsLimit: limit > 0 ? limit : Math.max(1000, Math.ceil(total / 500) * 500),
      cohortDoctrine,
      // The most common pick for each army-wide choice (New Recruit stores one per unit)
      armyChoices: Object.fromEntries(
        Object.entries(armyChoiceVotes).map(([g, votes]) => [g, Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]])
      ),
      forces,
    },
    warnings,
  };
}
