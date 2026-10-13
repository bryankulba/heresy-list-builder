import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { importRos } from '../utils/importRos';
import { auxiliaryUnlocks, detachmentAllowances } from './detachmentLimits';
import { getUnitsForFaction, unitVariant } from '../data/loader';

const load = (file: string) =>
  importRos(readFileSync(join(__dirname, '../../reference_armies', file), 'utf-8')).snapshot.forces;

const auxiliary = (forces: ReturnType<typeof load>) =>
  detachmentAllowances(forces, forces[0]).find((a) => a.name === 'Auxiliary Detachment(s)')!;

describe('detachment limits from BSData', () => {
  test('an extra Auxiliary detachment shows as over the limit (as New Recruit reported)', () => {
    expect(auxiliary(load('death-guard_v2.ros'))).toMatchObject({ used: 4, max: 3 });
    expect(auxiliary(load('death-guard_v2_fixed.ros'))).toMatchObject({ used: 3, max: 3 });
    // Two Command units (Siege Breaker, Vigilator) but three Auxiliary detachments — a real list error
    expect(auxiliary(load('I am Patient I am the End (3500 points no Legion uniques).ros'))).toMatchObject({ used: 3, max: 2 });
  });

  test('High Command "One Apex Detachment" raises the Apex limit', () => {
    const forces = load('death-guard_v1.ros');
    const apex = detachmentAllowances(forces, forces[0]).find((a) => a.name.startsWith('Apex'));
    expect(apex).toMatchObject({ used: 1, max: 1 });
  });

  test('a Centurion unlocks 2 Auxiliary as Command, 1 in a "Centurions Only" slot', () => {
    const forces = load('death-guard_v2_fixed.ros');
    const centurionSlot = (name: string) => {
      const det = forces[0].detachments.find(
        (d) => d.def.name === name && Object.values(d.slots).some((s) => s?.unit.name === 'Centurion')
      )!;
      return [det.id, Object.entries(det.slots).find(([, s]) => s?.unit.name === 'Centurion')![0]] as const;
    };
    expect(auxiliaryUnlocks(forces, ...centurionSlot('Crusade Primary Detachment'))).toBe(2);
    expect(auxiliaryUnlocks(forces, ...centurionSlot('Auxiliary - Tactical Support'))).toBe(1);
  });

  test('an alternate link swaps the unit\'s link categories', () => {
    const centurion = getUnitsForFaction('death-guard').find((u) => u.name === 'Centurion')!;
    const onlyLink = centurion.alternateLinks!.find((l) => l.category === 'Command - Centurions Only')!;
    const variant = unitVariant(centurion, onlyLink);
    expect(centurion.facts?.['6dbf-654a-f06f-2d69']).toBe(1); // Command
    expect(variant.facts?.['6dbf-654a-f06f-2d69']).toBeUndefined();
    expect(variant.facts?.['901a-6b71-7a29-4597']).toBe(1); // Officer of the Line (2) stays
  });
});
