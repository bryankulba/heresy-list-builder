import { describe, test, expect } from 'vitest';
import {
  addDetachment,
  allDetachments,
  computeTotalPoints,
  createForce,
  factionOfDetachment,
  migrateSnapshot,
  refreshUnits,
  removeDetachmentCascade,
} from './rosterModel';
import { getAllyFactions, getChart, getUnitsForFaction } from '../data/loader';
import type { PlacedDetachment, RosterSnapshotV1, UnitEntry } from '../types';

const crusade = getChart('Crusade Force Organization Chart');
const aux = (name: string) => crusade.detachments.find((d) => d.name === `Auxiliary - ${name}`)!;
const unitNamed = (faction: string, name: string) => getUnitsForFaction(faction).find((u) => u.name === name)!;

describe('createForce', () => {
  test('a primary army starts with its chart’s primary detachment', () => {
    const force = createForce('death-guard', 'primary');
    expect(force.chart).toBe('Crusade Force Organization Chart');
    expect(force.detachments.map((d) => d.def.name)).toEqual(['Crusade Primary Detachment']);
  });

  test('Knight Households use their own chart', () => {
    const force = createForce('questoris-familia', 'primary');
    expect(force.chart).toBe('Knight Households Crusade');
    expect(force.detachments[0].def.name).toBe('Knight Households Primary Detachment');
  });

  test('an allied army starts with an Allied Detachment', () => {
    const force = createForce('mechanicum', 'allied');
    expect(force.chart).toBe('Allied Detachment and its Auxiliary');
    expect(force.detachments[0].def.type).toBe('allied');
  });
});

describe('forces', () => {
  test('unlocked detachments join the unlocking army; cascade removal crosses only that army', () => {
    const primary = createForce('death-guard', 'primary');
    const allies = createForce('mechanicum', 'allied');
    const alliedRoot = allies.detachments[0];

    let forces = addDetachment([primary, allies], aux('Armoured Fist'), { unlockedBy: `${alliedRoot.id}::Command-0` });
    forces = addDetachment(forces, aux('Heavy Support'), {
      unlockedBy: `${primary.detachments[0].id}::Command-0`,
    });
    expect(forces[0].detachments.map((d) => d.def.name)).toEqual(['Crusade Primary Detachment', 'Auxiliary - Heavy Support']);
    expect(forces[1].detachments.map((d) => d.def.name)).toEqual(['Allied Detachment', 'Auxiliary - Armoured Fist']);
    expect(factionOfDetachment(forces, forces[1].detachments[1].id)).toBe('mechanicum');
    expect(factionOfDetachment(forces, `${alliedRoot.id}::Command-0`)).toBe('mechanicum');

    forces = removeDetachmentCascade(forces, alliedRoot.id);
    expect(allDetachments(forces).map((d) => d.def.name)).toEqual([
      'Crusade Primary Detachment',
      'Auxiliary - Heavy Support',
    ]);
  });

  test('total points include allies', () => {
    const primary = createForce('death-guard', 'primary');
    const allies = createForce('mechanicum', 'allied');
    const marines = unitNamed('death-guard', 'Tactical Squad');
    const tech = getUnitsForFaction('mechanicum').find((u) => u.role === 'Troops')!;
    primary.detachments[0].slots['Troops-1'] = { unit: marines, extraPoints: 10 };
    allies.detachments[0].slots['Troops-0'] = { unit: tech };
    expect(computeTotalPoints([primary, allies])).toBe(marines.points + 10 + tech.points);
  });
});

describe('allies', () => {
  test('Knight Households may not take allies', () => {
    expect(getAllyFactions('questoris-familia')).toEqual([]);
  });

  test('a legion may ally with Mechanicum and the Talons, but not itself', () => {
    const ids = getAllyFactions('death-guard').map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['mechanicum', 'legio-custodes', 'anathema-psykana', 'skitarii-conclaves']));
    expect(ids).not.toContain('death-guard');
  });
});

describe('persistence', () => {
  const primaryDef = crusade.detachments.find((d) => d.name === 'Crusade Primary Detachment')!;

  test('schemaVersion 1 saves become a single primary army', () => {
    const det: PlacedDetachment = { id: 'd1', def: primaryDef, slots: {} };
    const v1: RosterSnapshotV1 = {
      faction: 'blood-angels',
      allegiance: 'Loyalist',
      pointsLimit: 2000,
      cohortDoctrine: '',
      detachments: [det],
    };
    const migrated = migrateSnapshot(v1);
    expect(migrated.pointsLimit).toBe(2000);
    expect(migrated.forces).toHaveLength(1);
    expect(migrated.forces[0]).toMatchObject({ faction: 'blood-angels', kind: 'primary', detachments: [det] });
  });

  test('refreshUnits replaces stale snapshots by entryId, then name + role', () => {
    const current = unitNamed('blood-angels', 'Sanguinius');
    const staleById: UnitEntry = { ...current, points: 970 };
    const rhino = unitNamed('blood-angels', 'Rhino');
    const staleByName: UnitEntry = { ...rhino, entryId: 'old-logisticae-link', points: 1 };
    const gone: UnitEntry = { ...rhino, name: 'Removed Unit', entryId: 'nope', points: 99 };

    const force = createForce('blood-angels', 'primary');
    force.detachments[0].slots = {
      'Warlord-0': { unit: staleById, notes: 'keep me' },
      'Transport-0': { unit: staleByName },
      'Transport-1': { unit: gone },
      'Troops-0': null,
    };
    const [fresh] = refreshUnits([force]);
    const slots = fresh.detachments[0].slots;
    expect(slots['Warlord-0']).toEqual({ unit: current, notes: 'keep me' });
    expect(slots['Transport-0']?.unit).toEqual(rhino);
    expect(slots['Transport-1']?.unit).toEqual(gone);
    expect(slots['Troops-0']).toBeNull();
  });
});

describe('Logistical Benefit from BSData', () => {
  test("the chosen role adds that slot, and old bonus slots migrate into it", async () => {
    const { getUnitsForFaction } = await import('../data/loader');
    const { getPrimeOptions, isLogisticalBenefit } = await import('../rules/primeBenefits');
    const { unitContext } = await import('../rules/context');
    const { withEffectiveSlots } = await import('../rules/slots');
    const force = createForce('death-guard', 'primary');
    const det = force.detachments[0];
    const tactical = getUnitsForFaction('death-guard').find((u) => u.name === 'Tactical Squad')!;
    const predator = getUnitsForFaction('death-guard').find((u) => u.name === 'Predator')!;
    const slot = det.def.slots.find((s) => s.role === 'Prime Troops')!;
    const lb = getPrimeOptions(tactical, unitContext([force], force, det, tactical, slot.categoryId)).find(isLogisticalBenefit)!;
    const benefit = { id: lb.id, name: lb.name, description: lb.description };

    // Without a role: no Armour slot in the Crusade Primary Detachment
    det.slots['Prime Troops-0'] = { unit: tactical, primeBenefit: benefit };
    expect(withEffectiveSlots([force])[0].detachments[0].def.slots.some((s) => s.role === 'Armour')).toBe(false);
    // "LB - Armour" chosen: BSData adds one Armour slot
    det.slots['Prime Troops-0'] = { unit: tactical, primeBenefit: benefit, lbRole: 'Armour' };
    expect(withEffectiveSlots([force])[0].detachments[0].def.slots.find((s) => s.role === 'Armour')?.max).toBe(1);

    // A list saved with the old bonus slot
    det.slots['Prime Troops-0'] = { unit: tactical, primeBenefit: benefit };
    det.bonusSlots = [{ id: 'b1', sourceSlotKey: 'Prime Troops-0', role: 'Armour', unit: predator }];
    const [migrated] = refreshUnits([force]);
    const mdet = migrated.detachments[0];
    expect(mdet.bonusSlots).toBeUndefined();
    expect(mdet.slots['Prime Troops-0']?.lbRole).toBe('Armour');
    expect(Object.entries(mdet.slots).find(([, s]) => s?.unit.name === 'Predator')?.[0]).toBe('Armour-0');
  });
});
