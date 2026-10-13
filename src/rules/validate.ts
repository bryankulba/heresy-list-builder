/**
 * validate.ts
 * Roster warnings, from the same BSData rules the builder evaluates elsewhere.
 * Warnings never block building or export — they flag what New Recruit would
 * report so the list can be fixed (or knowingly kept).
 */

import type { Allegiance, Force, PlacedDetachment } from '../types';
import { getDetachmentDisplayName } from '../data/loader';
import { computeTotalPoints } from '../store/rosterModel';
import { cardSlots, expandSlots } from '../components/canvas/slotLayout';
import { rosterCounts, type RosterCounts } from './context';
import { allegianceCounts, isAllegianceLocked } from './availability';
import { detachmentAllowances, detachmentCaps } from './detachmentLimits';
import { isLogisticalBenefit } from './primeBenefits';
import { withEffectiveSlots } from './slots';

export interface RosterWarning {
  /** Stable key (for React lists and de-duplication) */
  id: string;
  message: string;
  /** The detachment it concerns, if any (shown as a badge on its card) */
  detachmentId?: string;
  /** The slot it concerns, if any (highlighted on the card) */
  slotKey?: string;
}

export interface ValidationInput {
  forces: Force[];
  allegiance: Allegiance;
  pointsLimit: number;
  /** BSData choice name ("Cohort Doctrine: …") */
  cohortDoctrine?: string;
  configChoices?: Record<string, string>;
}

const POINTS_TYPE_ID = '9893-c379-920b-8982';

const detName = (det: PlacedDetachment) => getDetachmentDisplayName(det.def.name);

/** Every unit placed in the roster, with where it sits. */
function placedUnits(forces: Force[]) {
  return forces.flatMap((force) =>
    force.detachments.flatMap((det) => [
      ...Object.entries(det.slots).flatMap(([slotKey, fs]) =>
        fs ? [{ force, det, slotKey, unit: fs.unit, filled: fs }] : []
      ),
    ])
  );
}

function pointsWarnings({ forces, pointsLimit }: ValidationInput): RosterWarning[] {
  const total = computeTotalPoints(forces);
  return total > pointsLimit
    ? [{ id: 'points', message: `${total - pointsLimit} points over the ${pointsLimit} point limit` }]
    : [];
}

/** Auxiliary / Apex detachment counts and the Lord of War points share. */
function allowanceWarnings(forces: Force[], counts: RosterCounts): RosterWarning[] {
  return forces.flatMap((force) =>
    detachmentAllowances(forces, force, counts)
      .filter((a) => a.used > a.max)
      .map((a): RosterWarning => {
        const root = force.detachments[0];
        if (a.costTypeId === POINTS_TYPE_ID) {
          return {
            id: `allowance-${force.id}-${a.costTypeId}`,
            message: `${detName(root)} is ${a.used - a.max} points over its share of the army (${a.max} points)`,
            detachmentId: root?.id,
          };
        }
        const kind = a.name.replace(/ Detachment\(s\)$/, '');
        return {
          id: `allowance-${force.id}-${a.costTypeId}`,
          message: `${a.used} ${kind} detachments, but the army allows ${a.max}`,
        };
      })
  );
}

/** Detachments taken more often than BSData allows (e.g. a Knight Additional detachment without what unlocks it). */
function capWarnings(forces: Force[], counts: RosterCounts): RosterWarning[] {
  return detachmentCaps(forces, counts)
    .filter((c) => c.used > c.max)
    .map((c) => ({
      id: `cap-${c.force.id}-${c.name}`,
      message:
        c.max === 0
          ? `Nothing in the army unlocks ${getDetachmentDisplayName(c.name)}`
          : `${c.used} × ${getDetachmentDisplayName(c.name)}, but the army allows ${c.max}`,
    }));
}

/** Slots BSData requires (min ≥ 1) that are empty. */
function compulsorySlotWarnings(view: Force[]): RosterWarning[] {
  return view.flatMap((force) =>
    force.detachments.flatMap((det) =>
      det.def.slots
        .filter((s) => s.min > 0)
        .flatMap((slot): RosterWarning[] => {
          const filled = cardSlots(det).filter((s) => s.slotDef.role === slot.role && det.slots[s.key]).length;
          return filled < slot.min
            ? [{
                id: `compulsory-${det.id}-${slot.role}`,
                message: `${detName(det)} needs ${slot.min - filled} more ${slot.role}`,
                detachmentId: det.id,
              }]
            : [];
        })
    )
  );
}

/** Units sitting outside the detachment's slots (e.g. a rule that made extra slots no longer applies). */
function overflowWarnings(view: Force[]): RosterWarning[] {
  return view.flatMap((force) =>
    // cardSlots lists the detachment's positions first, then any unit left outside them
    force.detachments.flatMap((det) =>
      cardSlots(det)
        .slice(expandSlots(det.def).length)
        .map(({ key }): RosterWarning => ({
          id: `overflow-${det.id}-${key}`,
          message: `${det.slots[key]?.unit.name ?? 'A unit'} doesn't fit a slot in ${detName(det)}`,
          detachmentId: det.id,
          slotKey: key,
        }))
    )
  );
}

/** Prime units that haven't chosen their Prime benefit. */
function primeBenefitWarnings(view: Force[]): RosterWarning[] {
  return view.flatMap((force) =>
    force.detachments.flatMap((det) => {
      const slotDefs = new Map(cardSlots(det).map((s) => [s.key, s.slotDef]));
      return Object.entries(det.slots).flatMap(([key, fs]): RosterWarning[] => {
        if (!fs?.unit.prime) return [];
        const prime = fs.isPrime ?? slotDefs.get(key)?.prime ?? false;
        if (prime && !fs.primeBenefit) {
          return [{
            id: `prime-${det.id}-${key}`,
            message: `${fs.unit.name} in ${detName(det)} has no Prime benefit`,
            detachmentId: det.id,
            slotKey: key,
          }];
        }
        // New Recruit requires the Logistical Benefit's slot role ("LB - Armour")
        return prime && fs.primeBenefit && isLogisticalBenefit(fs.primeBenefit) && !fs.lbRole
          ? [{
              id: `lb-${det.id}-${key}`,
              message: `${fs.unit.name}'s Logistical Benefit in ${detName(det)} has no slot role chosen`,
              detachmentId: det.id,
              slotKey: key,
            }]
          : [];
      });
    })
  );
}

/** Units BSData limits per roster (unique characters). */
function uniqueWarnings(forces: Force[]): RosterWarning[] {
  const byUnit = new Map<string, Array<ReturnType<typeof placedUnits>[number]>>();
  for (const p of placedUnits(forces)) {
    if (p.unit.rosterMax === undefined) continue;
    const key = p.unit.path ?? p.unit.name;
    byUnit.set(key, [...(byUnit.get(key) ?? []), p]);
  }
  return [...byUnit.values()].flatMap((placed) => {
    const max = placed[0].unit.rosterMax!;
    return placed.length > max
      ? placed.map((p, i): RosterWarning => ({
          id: `unique-${p.det.id}-${p.slotKey ?? i}`,
          message: `${p.unit.name} may be taken ${max === 1 ? 'only once' : `at most ${max} times`} (${placed.length} in the list)`,
          detachmentId: p.det.id,
          slotKey: p.slotKey,
        }))
      : [];
  });
}

/** Units the roster's allegiance can't field — e.g. a Traitor-only character in a Loyalist army. */
function availabilityWarnings(forces: Force[], allegiance: Allegiance): RosterWarning[] {
  const counts = allegianceCounts(forces, allegiance);
  return placedUnits(forces).flatMap(({ force, det, slotKey, unit }): RosterWarning[] =>
    isAllegianceLocked(forces, force, det, unit, counts)
      ? [{
          id: `allegiance-${det.id}-${slotKey ?? unit.name}`,
          message: `${unit.name} can't be taken by a ${allegiance} army`,
          detachmentId: det.id,
          slotKey,
        }]
      : []
  );
}

export function validateRoster(input: ValidationInput): RosterWarning[] {
  const { forces, allegiance, pointsLimit, cohortDoctrine, configChoices } = input;
  const counts = rosterCounts(forces, { allegiance, pointsLimit, cohortDoctrine, configChoices });
  const view = withEffectiveSlots(forces, counts);
  return [
    ...pointsWarnings(input),
    ...allowanceWarnings(forces, counts),
    ...capWarnings(forces, counts),
    ...compulsorySlotWarnings(view),
    ...overflowWarnings(view),
    ...primeBenefitWarnings(view),
    ...uniqueWarnings(forces),
    ...availabilityWarnings(forces, allegiance),
  ];
}
