/**
 * context.ts
 * Builds RuleContexts (see evaluate.ts) from the roster.
 */

import type { Allegiance, Force, PlacedDetachment, UnitEntry } from '../types';
import { cataloguesData, getChart, rulesData } from '../data/loader';
import { configCounts } from './armyConfig';
import { logisticalBenefitChoice } from './primeBenefits';
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

/**
 * The kind of detachment each High Command slot chose to unlock ("One Apex /
 * One Auxiliary Detachment"), by "detId::slotKey": from the detachments it
 * unlocked, else from choices carried over by an import.
 */
function detachmentChoicesBySlot(forces: Force[]): Map<string, Array<'apex' | 'auxiliary'>> {
  const out = new Map<string, Array<'apex' | 'auxiliary'>>();
  for (const det of forces.flatMap((f) => f.detachments)) {
    if (!det.unlockedBy || (det.def.type !== 'apex' && det.def.type !== 'auxiliary')) continue;
    out.set(det.unlockedBy, [...(out.get(det.unlockedBy) ?? []), det.def.type]);
  }
  for (const det of forces.flatMap((f) => f.detachments)) {
    for (const [key, fs] of Object.entries(det.slots)) {
      const ref = `${det.id}::${key}`;
      if (fs?.detachmentChoices?.length && !out.has(ref)) out.set(ref, fs.detachmentChoices);
    }
  }
  return out;
}

function detachmentCounts(det: PlacedDetachment, choices: Map<string, Array<'apex' | 'auxiliary'>>): Counts {
  const counts: Counts = {};
  for (const [key, fs] of Object.entries(det.slots)) {
    if (!fs) continue;
    addCounts(counts, slotCounts(fs.unit, fs.primeBenefit?.id));
    // A Logistical Benefit's chosen role ("LB - Armour"), which BSData counts to add that slot
    if (fs.lbRole && fs.primeBenefit) {
      const choice = logisticalBenefitChoice(fs.unit, fs.primeBenefit, fs.lbRole);
      if (choice) counts[choice.id] = (counts[choice.id] ?? 0) + 1;
    }
    // A High Command unit's detachment choice (and its "+1 Apex from High Command" category)
    if (fs.unit.detachmentChoice) {
      for (const kind of choices.get(`${det.id}::${key}`) ?? []) {
        const choice = rulesData.detachmentChoice[kind];
        for (const id of [choice?.id, ...(choice?.categoryIds ?? [])]) if (id) counts[id] = (counts[id] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export interface RosterCounts {
  roster: Counts;
  rosterForces: Counts;
  byDetachment: Map<string, Counts>;
  /** Points spent on selections of each id/category ("any" = everything) */
  rosterCosts: Counts;
  pointsLimit?: number;
}

/** Army-level choices that BSData conditions count in the roster. */
export interface RosterOptions {
  allegiance?: Allegiance;
  pointsLimit?: number;
  /** BSData choice name, e.g. "Cohort Doctrine: Mechanised Pattern Cohort" */
  cohortDoctrine?: string;
}

export function rosterCounts(forces: Force[], opts: RosterOptions = {}): RosterCounts {
  const roster: Counts = {};
  const rosterCosts: Counts = {};
  const rosterForces: Counts = {};
  const byDetachment = new Map<string, Counts>();
  const choices = detachmentChoicesBySlot(forces);
  for (const force of forces) {
    const chartId = getChart(force.chart).id;
    rosterForces[chartId] = (rosterForces[chartId] ?? 0) + 1;
    for (const det of force.detachments) {
      if (det.def.entryId) rosterForces[det.def.entryId] = (rosterForces[det.def.entryId] ?? 0) + 1;
      const counts = detachmentCounts(det, choices);
      byDetachment.set(det.id, counts);
      addCounts(roster, counts);
      const units = Object.values(det.slots).flatMap((fs) => (fs ? [{ unit: fs.unit, extra: fs.extraPoints ?? 0 }] : []));
      for (const { unit, extra } of units) {
        const points = unit.points + extra;
        rosterCosts.any = (rosterCosts.any ?? 0) + points;
        for (const id of Object.keys(unit.facts ?? {})) rosterCosts[id] = (rosterCosts[id] ?? 0) + points;
      }
    }
  }
  // The army's configuration (allegiance, cohort doctrine) — chosen in the app, not placed as units
  addCounts(roster, configCounts(forces.find((f) => f.kind === 'primary')?.faction, opts));
  return { roster, rosterForces, byDetachment, rosterCosts, pointsLimit: opts.pointsLimit };
}

/** Context for a detachment's own slots (their max modifiers). */
export function detachmentContext(
  forces: Force[],
  force: Force,
  detachment: PlacedDetachment,
  counts: RosterCounts = rosterCounts(forces)
): RuleContext {
  return {
    catalogueId: cataloguesData[force.faction]?.catalogueId ?? '',
    forceEntryIds: [detachment.def.entryId ?? '', getChart(force.chart).id].filter(Boolean),
    unit: {},
    force: counts.byDetachment.get(detachment.id) ?? {},
    roster: counts.roster,
    rosterForces: counts.rosterForces,
    rosterCosts: counts.rosterCosts,
    pointsLimit: counts.pointsLimit,
    level: 'detachment',
  };
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
    rosterCosts: counts.rosterCosts,
    pointsLimit: counts.pointsLimit,
  };
}
