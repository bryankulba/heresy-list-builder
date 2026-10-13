import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { importRos } from '../../utils/importRos';
import { stackedOrder } from './StackedView';

describe('stackedOrder (phone layout)', () => {
  test('each unlocked detachment follows the one whose slot unlocked it, tagged with that unit', () => {
    const xml = readFileSync(join(__dirname, '../../../reference_armies/death-guard_v2_fixed.ros'), 'utf-8');
    const [force] = importRos(xml).snapshot.forces;
    const order = stackedOrder(force).map(({ det, unlockedBy, depth }) => [det.def.name, unlockedBy ?? null, depth]);
    expect(order[0]).toEqual(['Crusade Primary Detachment', null, 0]);
    expect(order).toHaveLength(force.detachments.length);
    // Every unlocked detachment comes after its parent, one level deeper
    for (const det of force.detachments.filter((d) => d.unlockedBy)) {
      const parentId = det.unlockedBy!.split('::')[0];
      const child = stackedOrder(force).findIndex((o) => o.det.id === det.id);
      const parent = stackedOrder(force).findIndex((o) => o.det.id === parentId);
      expect(child).toBeGreaterThan(parent);
      expect(stackedOrder(force)[child].depth).toBe(stackedOrder(force)[parent].depth + 1);
    }
    expect(order.some(([, by]) => by === 'Centurion')).toBe(true);
  });
});
