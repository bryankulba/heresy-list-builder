/**
 * sampleArmies.ts
 * Builds test armies the way a person would in the app, from the same rules:
 * each detachment's slots filled, while the points allow, with units the army
 * may take there (its allegiance, no banned or unique units — a different one
 * per slot of a role, for variety),
 * Prime benefits picked, the detachments Command / High Command units unlock
 * added and filled, squads at a middling size — all within the points limit.
 * Used to produce .ros files for checking in New Recruit (`npm run samples`).
 */

import type { Allegiance, FilledSlot, Force, PlacedDetachment, UnitEntry } from '../types';
import { ZONE_MORTALIS_CHART } from '../data/factions';
import { getDetachmentsForFaction } from '../data/loader';
import { addDetachment, computeTotalPoints, createForce, removeDetachmentCascade, updateDetachment } from '../store/rosterModel';
import { rosterCounts, unitContext } from '../rules/context';
import { withEffectiveSlots, unitsForSlot } from '../rules/slots';
import { detachmentAvailability, fillableSlots } from '../rules/options';
import { auxiliaryUnlocks } from '../rules/detachmentLimits';
import { allegianceCounts, chartBan, isAllegianceLocked } from '../rules/availability';
import { getPrimeOptions } from '../rules/primeBenefits';
import { defaultConfigChoices, doctrineOptions } from '../rules/armyConfig';
import { defaultArmyChoices } from '../rules/armyChoices';
import { isSizeAdjustable, modelKey, slotPoints } from '../rules/unitSize';
import { cardSlots } from '../components/canvas/slotLayout';
import { buildRosXml } from '../utils/buildRos';

export interface SampleSpec {
  file: string;
  faction: string;
  allegiance: Allegiance;
  pointsLimit: number;
  /** Zone Mortalis primary detachment (a Crusade army when unset) */
  zoneMortalis?: string;
  /** Allied armies */
  allies?: string[];
}

export interface SampleArmy {
  spec: SampleSpec;
  forces: Force[];
  cohortDoctrine: string;
  armyChoices: Record<string, string>;
  configChoices: Record<string, string>;
}

/** Benefits that need a further choice or a special slot — left to the person */
const SKIP_BENEFITS = /^(Logistical Benefit|Clade Operative|Cult Operative)/;
/** Slot roles left empty (dedicated transports need passengers to make sense) */
const SKIP_ROLES = new Set(['Transport', 'Heavy Transport']);

function findDet(forces: Force[], detId: string) {
  const force = forces.find((f) => f.detachments.some((d) => d.id === detId))!;
  return { force, det: force.detachments.find((d) => d.id === detId)! };
}

/** Units the army may take in a slot: allowed by allegiance and chart, not unique, priced. */
function candidates(
  forces: Force[],
  force: Force,
  det: PlacedDetachment,
  slot: Parameters<typeof unitsForSlot>[3],
  allegiance: Allegiance
): UnitEntry[] {
  const counts = rosterCounts(forces, { allegiance });
  const locked = allegianceCounts(forces, allegiance);
  return unitsForSlot(forces, force, det, slot, counts).filter(
    (u) => !u.rosterMax && !chartBan(force, u) && !isAllegianceLocked(forces, force, det, u, locked) && u.points > 0
  );
}

/** The `n`th affordable candidate (wrapping), so a role's slots get different units. */
function pickUnit(options: UnitEntry[], n: number, budget: number): UnitEntry | undefined {
  const affordable = options.filter((u) => u.points <= budget);
  return affordable.length > 0 ? affordable[n % affordable.length] : undefined;
}

/** Whether a detachment has a slot the generator would fill. */
function hasFillableSlot(forces: Force[], force: Force, def: PlacedDetachment['def'], allegiance: Allegiance): boolean {
  const probe: PlacedDetachment = { id: '__probe__', def, slots: {} };
  return def.slots.some(
    (s) =>
      s.max > 0 &&
      !SKIP_ROLES.has(s.role.replace(/^Prime /, '').split(' - ')[0]) &&
      !/Operative$/.test(s.role) &&
      candidates(forces, force, probe, s, allegiance).length > 0
  );
}

interface Unlock {
  detId: string;
  key: string;
  role: string;
}

/**
 * Fills a detachment's slots while the roster stays within `ceiling` points;
 * returns the slots whose units unlock detachments, to take afterwards (so a
 * detachment's own Troops come before what its Command units unlock).
 */
function fillDetachment(
  forces: Force[],
  spec: SampleSpec,
  detId: string,
  ceiling: number
): { forces: Force[]; unlocks: Unlock[] } {
  const unlocks: Unlock[] = [];
  const counts = rosterCounts(forces, { allegiance: spec.allegiance, pointsLimit: spec.pointsLimit });
  const view = withEffectiveSlots(forces, counts);
  const { force: viewForce, det: viewDet } = findDet(view, detId);
  const shown = { ...viewDet, def: { ...viewDet.def, slots: fillableSlots(forces, viewForce, viewDet, counts) } };
  const filledOfRole = new Map<string, number>();

  for (const { key, slotDef } of cardSlots(shown)) {
    const role = slotDef.role.replace(/^Prime /, '');
    if (SKIP_ROLES.has(role.split(' - ')[0]) || /Operative$/.test(role)) continue;

    const { force, det } = findDet(forces, detId);
    if (det.slots[key]) continue;
    const budget = ceiling - computeTotalPoints(forces);
    const n = filledOfRole.get(role) ?? 0;
    const unit = pickUnit(candidates(forces, force, det, slotDef, spec.allegiance), n, budget);
    if (!unit) continue;
    filledOfRole.set(role, n + 1);

    // Prime benefit: the first that needs no further choice
    const benefit = slotDef.prime
      ? getPrimeOptions(unit, unitContext(forces, force, det, unit, slotDef.categoryId, counts)).find((o) => !SKIP_BENEFITS.test(o.name))
      : undefined;
    // A squad at a middling size, if the points allow
    const sized = unit.models.find(isSizeAdjustable);
    const filled: FilledSlot = {
      unit,
      ...(benefit ? { primeBenefit: { id: benefit.id, name: benefit.name, description: benefit.description } } : {}),
    };
    if (sized) {
      const n = sized.min + Math.floor((sized.max - sized.min) / 2);
      const withSize = { ...filled, modelCounts: { [modelKey(sized)]: n } };
      if (slotPoints(withSize) <= budget && n !== sized.min) filled.modelCounts = withSize.modelCounts;
    }
    forces = updateDetachment(forces, detId, (d) => ({ ...d, slots: { ...d.slots, [key]: filled } }));

    const baseRole = role.split(' - ')[0];
    if (baseRole === 'High Command' || baseRole === 'Command') unlocks.push({ detId, key, role: baseRole });
  }
  return { forces, unlocks };
}

/** Adds and fills the detachments a slot's unit unlocks (their own unlocks aren't followed). */
function takeUnlocks(forces: Force[], spec: SampleSpec, { detId, key, role }: Unlock): Force[] {
  const { force } = findDet(forces, detId);
  const unlockedBy = `${detId}::${key}`;
  const type = role === 'High Command' ? 'apex' : 'auxiliary';
  const count = role === 'High Command' ? 1 : auxiliaryUnlocks(forces, detId, key);
  for (let i = 0; i < count; i++) {
    const taken = new Set(force.detachments.map((d) => d.def.name));
    const counts = rosterCounts(forces, { allegiance: spec.allegiance, pointsLimit: spec.pointsLimit });
    const current = forces.find((f) => f.id === force.id)!;
    const def = getDetachmentsForFaction(type, force.faction, force.chart).find(
      (d) =>
        !taken.has(d.name) &&
        detachmentAvailability(forces, current, d, counts).status === 'ok' &&
        hasFillableSlot(forces, current, d, spec.allegiance)
    );
    if (!def) break;
    forces = addDetachment(forces, def, { unlockedBy });
    const added = forces.find((f) => f.id === force.id)!.detachments.at(-1)!;
    forces = fillDetachment(forces, spec, added.id, spec.pointsLimit).forces;
    // Out of points: don't leave an empty detachment behind
    if (!Object.values(findDet(forces, added.id).det.slots).some(Boolean)) {
      forces = removeDetachmentCascade(forces, added.id);
      break;
    }
  }
  return forces;
}

export function buildSampleArmy(spec: SampleSpec): SampleArmy {
  const primary = createForce(
    spec.faction,
    'primary',
    spec.zoneMortalis ? { chart: ZONE_MORTALIS_CHART, primary: spec.zoneMortalis } : undefined
  );
  let forces: Force[] = [primary, ...(spec.allies ?? []).map((ally) => createForce(ally, 'allied'))];
  // Each army's root detachment first, leaving room for what it unlocks (and
  // keeping an ally well inside its share of the points), then the unlocks
  const unlocks: Unlock[] = [];
  forces.forEach((force, i) => {
    const share = i === 0 ? 0.4 : 0.4 + 0.15 * i;
    const result = fillDetachment(forces, spec, force.detachments[0].id, Math.round(spec.pointsLimit * share));
    forces = result.forces;
    unlocks.push(...result.unlocks);
  });
  for (const unlock of unlocks) forces = takeUnlocks(forces, spec, unlock);
  // Points left over (or nothing to unlock, as for Knights): fill the root detachments further
  forces.forEach((force, i) => {
    const ceiling = i === 0 ? spec.pointsLimit : Math.round(spec.pointsLimit * Math.min(1, 0.4 + 0.15 * i));
    forces = fillDetachment(forces, spec, force.detachments[0].id, ceiling).forces;
  });
  return {
    spec,
    forces,
    cohortDoctrine: doctrineOptions(spec.faction)[0] ?? '',
    armyChoices: defaultArmyChoices(spec.faction),
    configChoices: defaultConfigChoices(spec.faction),
  };
}

export function sampleRos(army: SampleArmy): string {
  return buildRosXml(army.forces, army.spec.pointsLimit, computeTotalPoints(army.forces), {
    allegiance: army.spec.allegiance,
    cohortDoctrine: army.cohortDoctrine,
    armyChoices: army.armyChoices,
    configChoices: army.configChoices,
  });
}

/** Ten armies across factions, Crusade and Zone Mortalis. */
export const SAMPLE_SPECS: SampleSpec[] = [
  { file: '01-death-guard-crusade', faction: 'death-guard', allegiance: 'Traitor', pointsLimit: 3000 },
  { file: '02-ultramarines-crusade', faction: 'ultramarines', allegiance: 'Loyalist', pointsLimit: 3000 },
  { file: '03-sons-of-horus-zm-strike-force', faction: 'sons-of-horus', allegiance: 'Traitor', pointsLimit: 1500, zoneMortalis: 'Primary - Zone Mortalis Strike Force' },
  { file: '04-imperial-fists-zm-bulwark', faction: 'imperial-fists', allegiance: 'Loyalist', pointsLimit: 1500, zoneMortalis: 'Primary - Zone Mortalis Bulwark' },
  { file: '05-solar-auxilia-crusade', faction: 'solar-auxilia', allegiance: 'Loyalist', pointsLimit: 3000 },
  { file: '06-mechanicum-crusade', faction: 'mechanicum', allegiance: 'Traitor', pointsLimit: 3000 },
  { file: '07-skitarii-crusade', faction: 'skitarii-conclaves', allegiance: 'Loyalist', pointsLimit: 2000 },
  { file: '08-legio-custodes-zm-linebreaker', faction: 'legio-custodes', allegiance: 'Loyalist', pointsLimit: 1500, zoneMortalis: 'Primary - Zone Mortalis Linebreaker' },
  { file: '09-questoris-familia-crusade', faction: 'questoris-familia', allegiance: 'Loyalist', pointsLimit: 2500 },
  { file: '10-iron-warriors-crusade-mechanicum-allies', faction: 'iron-warriors', allegiance: 'Traitor', pointsLimit: 3000, allies: ['mechanicum'] },
];
