import { describe, test, expect } from 'vitest';
import { ZONE_MORTALIS_CHART } from '../data/factions';
import { getChart, getDetachmentsForFaction, getUnitsForFaction, zoneMortalisPrimaries } from '../data/loader';
import { addDetachment, createForce, updateDetachment } from '../store/rosterModel';
import { buildRosXml } from '../utils/buildRos';
import { importRos } from '../utils/importRos';
import { chartBan } from './availability';
import { detachmentAvailability } from './options';
import { detachmentAllowances } from './detachmentLimits';
import { validateRoster } from './validate';
import type { Force } from '../types';

const unit = (name: string) => getUnitsForFaction('death-guard').find((u) => u.name === name)!;

function zmArmy(primary = 'Primary - Zone Mortalis Strike Force'): Force[] {
  return [createForce('death-guard', 'primary', { chart: ZONE_MORTALIS_CHART, primary })];
}

function fill(forces: Force[], detName: string, slotKey: string, unitName: string): Force[] {
  const det = forces[0].detachments.find((d) => d.def.name === detName)!;
  return updateDetachment(forces, det.id, (d) => ({ ...d, slots: { ...d.slots, [slotKey]: { unit: unit(unitName) } } }));
}

describe('Zone Mortalis', () => {
  test('a Crusade army may play on the Strike Force, Bulwark, Linebreaker or Crusade primary', () => {
    expect(zoneMortalisPrimaries('death-guard').map((d) => d.name).sort()).toEqual([
      'Primary - Crusade Primary Detachment',
      'Primary - Zone Mortalis Bulwark',
      'Primary - Zone Mortalis Linebreaker',
      'Primary - Zone Mortalis Strike Force',
    ]);
    // Knights aren't built on the Crusade chart
    expect(zoneMortalisPrimaries('questoris-familia')).toEqual([]);
  });

  test('the Strike Force has its BSData slots', () => {
    const det = zmArmy()[0].detachments[0];
    const max = (role: string) => det.def.slots.find((s) => s.role === role)?.max;
    expect([max('High Command'), max('Command'), max('Troops'), max('Prime Troops'), max('Heavy Assault')]).toEqual([1, 1, 4, 1, 2]);
  });

  test('its Auxiliary detachments are the ones the chart links from the Crusade chart', () => {
    const aux = getDetachmentsForFaction('auxiliary', 'death-guard', ZONE_MORTALIS_CHART);
    const tactical = aux.find((d) => d.name === 'Auxiliary - Tactical Support');
    expect(tactical?.linkId).toBeTruthy();
    expect(tactical?.entryId).toBe('2965-5682-3cbc-8b47');
    // Other legions' detachments stay out
    expect(aux.some((d) => d.name === 'Auxiliary - Ravenwing Lance')).toBe(false);
  });

  test('Auxiliary detachments come from Command units, as in a Crusade', () => {
    const empty = detachmentAllowances(zmArmy(), zmArmy()[0]).find((a) => a.name === 'Auxiliary Detachment(s)');
    expect(empty?.max).toBe(0);
    const forces = fill(zmArmy(), 'Primary - Zone Mortalis Strike Force', 'Command-0', 'Centurion');
    const aux = detachmentAllowances(forces, forces[0]).find((a) => a.name === 'Auxiliary Detachment(s)');
    expect(aux?.max).toBeGreaterThan(0);
  });

  test('vehicles BSData marks "Invalid ZM Vehicle" are banned in Zone Mortalis only', () => {
    const zm = zmArmy()[0];
    const crusade = createForce('death-guard', 'primary');
    expect(chartBan(zm, unit('Rhino'))).toMatch(/not allowed in games of Zone Mortalis/);
    expect(chartBan(crusade, unit('Rhino'))).toBeUndefined();
    expect(chartBan(zm, unit('Tactical Squad'))).toBeUndefined();
  });

  test('detachments only banned units could fill are not offered (Armoured Fist: transports)', () => {
    const forces = fill(zmArmy(), 'Primary - Zone Mortalis Strike Force', 'Command-0', 'Centurion');
    const aux = getDetachmentsForFaction('auxiliary', 'death-guard', ZONE_MORTALIS_CHART);
    const status = (name: string) => detachmentAvailability(forces, forces[0], aux.find((d) => d.name === name)!).status;
    expect(status('Auxiliary - Armoured Fist')).toBe('hidden');
    expect(status('Auxiliary - Tactical Support')).toBe('ok');
  });

  test('a banned unit (e.g. from an import) is a warning on its slot', () => {
    const forces = fill(zmArmy(), 'Primary - Zone Mortalis Strike Force', 'Heavy Assault-0', 'Rhino');
    const warnings = validateRoster({ forces, allegiance: 'Loyalist', pointsLimit: 1000 });
    expect(warnings.find((w) => w.id.startsWith('ban:'))).toMatchObject({ slotKey: 'Heavy Assault-0' });
  });

  test('export: the Zone Mortalis root force, its configuration, and linked detachments round-trip', () => {
    let forces = fill(zmArmy(), 'Primary - Zone Mortalis Strike Force', 'Command-0', 'Centurion');
    const tactical = getDetachmentsForFaction('auxiliary', 'death-guard', ZONE_MORTALIS_CHART).find(
      (d) => d.name === 'Auxiliary - Tactical Support'
    )!;
    const primaryId = forces[0].detachments[0].id;
    forces = addDetachment(forces, tactical, { unlockedBy: `${primaryId}::Command-0` });
    const xml = buildRosXml(forces, 1000, 80, { allegiance: 'Loyalist' });

    const chart = getChart(ZONE_MORTALIS_CHART);
    expect(xml).toContain(`name="Zone Mortalis" entryId="${chart.id}"`);
    // Required configuration: Zone Mortalis with its special rules, terrain and reactions
    for (const name of ['Zone Mortalis Special Rules', 'Zone Mortalis Terrain', 'Zone Mortalis Advanced Reactions']) {
      expect(xml).toContain(`name="${name}"`);
    }
    expect(xml).toContain(`entryId="${tactical.linkId}::${tactical.entryId}"`);

    const back = importRos(xml).snapshot.forces;
    expect(back[0].chart).toBe(ZONE_MORTALIS_CHART);
    expect(back[0].detachments.map((d) => d.def.name)).toEqual([
      'Primary - Zone Mortalis Strike Force',
      'Auxiliary - Tactical Support',
    ]);
  });

  test('a Crusade export has no Zone Mortalis configuration', () => {
    const xml = buildRosXml([createForce('death-guard', 'primary')], 1000, 0, { allegiance: 'Loyalist' });
    expect(xml).not.toContain('Zone Mortalis');
  });
});
