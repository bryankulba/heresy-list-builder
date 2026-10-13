import { describe, test, expect } from 'vitest';
import { getUnitsForFaction } from '../data/loader';
import { createForce, updateDetachment, computeTotalPoints } from '../store/rosterModel';
import { buildRosXml } from '../utils/buildRos';
import { importRos } from '../utils/importRos';
import { isSizeAdjustable, modelCount, modelKey, slotPoints, unitModelTotal } from './unitSize';
import type { FilledSlot } from '../types';

const unit = (name: string) => getUnitsForFaction('death-guard').find((u) => u.name === name)!;
const legionary = () => unit('Tactical Squad').models.find((m) => m.name === 'Legionary')!;

describe('unit size', () => {
  test('a unit starts at its minimum size and points', () => {
    const fs: FilledSlot = { unit: unit('Tactical Squad') };
    expect(modelCount(fs, legionary())).toBe(9);
    expect(unitModelTotal(fs)).toBe(10);
    expect(slotPoints(fs)).toBe(100);
  });

  test('extra models add their BSData cost; counts stay within the range', () => {
    const at = (n: number): FilledSlot => ({ unit: unit('Tactical Squad'), modelCounts: { [modelKey(legionary())]: n } });
    expect(slotPoints(at(14))).toBe(150);
    expect(unitModelTotal(at(14))).toBe(15);
    expect(modelCount(at(40), legionary())).toBe(19);
    expect(modelCount(at(2), legionary())).toBe(9);
  });

  test('fixed-size models are not adjustable', () => {
    const sergeant = unit('Tactical Squad').models.find((m) => m.name === 'Sergeant')!;
    expect(isSizeAdjustable(sergeant)).toBe(false);
    expect(isSizeAdjustable(legionary())).toBe(true);
  });

  test('export writes the size (wargear scales) and import reads it back', () => {
    const force = createForce('death-guard', 'primary');
    const det = force.detachments[0];
    const forces = updateDetachment([force], det.id, (d) => ({
      ...d,
      slots: { ...d.slots, 'Troops-0': { unit: unit('Tactical Squad'), modelCounts: { [modelKey(legionary())]: 14 } } },
    }));
    expect(computeTotalPoints(forces)).toBe(150);
    const xml = buildRosXml(forces, 3000, 150, { allegiance: 'Loyalist' });
    expect(xml).toMatch(/name="Legionary"[^>]*number="14"/);
    expect(xml).toMatch(/name="Bolter"[^>]*number="14"/);

    const back = importRos(xml).snapshot.forces;
    const slot = Object.values(back[0].detachments[0].slots).find((s) => s?.unit.name === 'Tactical Squad')!;
    expect(unitModelTotal(slot)).toBe(15);
    expect(slotPoints(slot)).toBe(150);
  });
});
