import { describe, test, expect } from 'vitest';
import { createForce } from '../store/rosterModel';
import { ZONE_MORTALIS_CHART } from '../data/factions';
import { unitReference } from './unitReference';

const find = (groups: ReturnType<typeof unitReference>, name: string) =>
  groups.flatMap((g) => g.units.map((u) => ({ ...u, role: g.role }))).find((u) => u.unit.name === name);

describe('unit reference', () => {
  test("groups the army's units by role, in force-org order", () => {
    const force = createForce('death-guard', 'primary');
    const groups = unitReference([force], force, 'Traitor');
    const roles = groups.map((g) => g.role);
    expect(roles.indexOf('High Command')).toBeLessThan(roles.indexOf('Command'));
    expect(roles.indexOf('Command')).toBeLessThan(roles.indexOf('Troops'));
    expect(find(groups, 'Tactical Squad')).toMatchObject({ role: 'Troops', size: '10–20 models', fromPoints: true });
  });

  test('tags Legion units, unique characters and allegiance', () => {
    const force = createForce('death-guard', 'primary');
    const traitor = unitReference([force], force, 'Traitor');
    const mortarion = find(traitor, 'Mortarion')!;
    expect(mortarion.tags.map((t) => t.label)).toEqual(expect.arrayContaining(['Legion', 'Unique', 'Traitor only']));
    const loyalist = unitReference([force], force, 'Loyalist');
    expect(find(loyalist, 'Mortarion')!.tags.map((t) => t.label)).toContain('Traitor only');
    expect(find(loyalist, 'Tactical Squad')!.tags).toEqual([]);
  });

  test('flags units Zone Mortalis bans', () => {
    const force = createForce('death-guard', 'primary', { chart: ZONE_MORTALIS_CHART, primary: 'Primary - Zone Mortalis Strike Force' });
    const groups = unitReference([force], force, 'Traitor');
    expect(find(groups, 'Rhino')!.tags.map((t) => t.label)).toContain('Not in Zone Mortalis');
  });
});
