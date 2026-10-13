import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { importRos } from '../utils/importRos';
import { validateRoster } from './validate';
import { addDetachment, createForce } from '../store/rosterModel';
import { getChart, getUnitsForFaction } from '../data/loader';
import type { Force } from '../types';

const load = (file: string) => importRos(readFileSync(join(__dirname, '../../reference_armies', file), 'utf-8')).snapshot;
const messages = (forces: Force[], allegiance: 'Loyalist' | 'Traitor' = 'Traitor', pointsLimit = 3000) =>
  validateRoster({ forces, allegiance, pointsLimit }).map((w) => w.message);

const unit = (faction: string, name: string) => getUnitsForFaction(faction).find((u) => u.name === name)!;

describe('validateRoster', () => {
  test('a clean list has no warnings', () => {
    const { forces, allegiance, pointsLimit } = load('death-guard_v2_fixed.ros');
    expect(validateRoster({ forces, allegiance, pointsLimit })).toEqual([]);
  });

  test('points and detachment limits', () => {
    const { forces, allegiance, pointsLimit } = load('I am Patient I am the End (3500 points no Legion uniques).ros');
    expect(messages(forces, allegiance, pointsLimit)).toContain('3 Auxiliary detachments, but the army allows 2');
    // The builder counts units at their size, without wargear (finished in New Recruit): 2840 here
    expect(messages(forces, allegiance, 2000)).toContain('840 points over the 2000 point limit');
  });

  test("Lord of War Detachment over its share of the army's points", () => {
    const { forces, allegiance } = load('XIV — Death Guard.ros');
    expect(forces.some((f) => f.kind === 'lordOfWar')).toBe(true);
    expect(messages(forces, allegiance, 2500).filter((m) => m.includes('share'))).toEqual([]); // 600 ≤ 625
    expect(messages(forces, allegiance, 2000)).toContain('Lord of War Detachment is 100 points over its share of the army (500 points)');
  });

  test('Prime unit without a benefit, and an empty compulsory slot', () => {
    const force = createForce('death-guard', 'primary');
    force.detachments[0].slots = { 'Prime Troops-0': { unit: unit('death-guard', 'Tactical Squad') } };
    const warlord = getChart('Crusade Force Organization Chart').detachments.find((d) => d.name === 'Warlord Detachment')!;
    const [withWarlord] = addDetachment([force], warlord, { forceId: force.id });
    expect(messages([withWarlord])).toEqual(
      expect.arrayContaining(['Tactical Squad in Crusade Primary Detachment has no Prime benefit', 'Warlord Detachment needs 1 more Warlord'])
    );
  });

  test('unique characters taken twice, and allegiance-locked units', () => {
    const force = createForce('night-lords', 'primary');
    const sevatar = unit('night-lords', 'Sevatar');
    force.detachments[0].slots = { 'High Command-0': { unit: sevatar }, 'Command-1': { unit: sevatar } };
    expect(messages([force], 'Traitor').filter((m) => m.startsWith('Sevatar may be taken only once'))).toHaveLength(2);
    expect(messages([force], 'Loyalist')).toContain("Sevatar can't be taken by a Loyalist army");
    expect(messages([force], 'Traitor').some((m) => m.includes("can't be taken"))).toBe(false);
  });

  test('a unit outside the slots', () => {
    const force = createForce('death-guard', 'primary');
    force.detachments[0].slots = { 'Troops-99': { unit: unit('death-guard', 'Tactical Squad') } };
    expect(messages([force])).toContain("Tactical Squad doesn't fit a slot in Crusade Primary Detachment");
  });

  test('a Logistical Benefit without its slot role', () => {
    const { forces, allegiance, pointsLimit } = load('death-guard_v7_fixed.ros');
    const det = forces[0].detachments[0];
    const { lbRole: _role, ...herald } = det.slots['Prime Command-0']!;
    det.slots['Prime Command-0'] = herald;
    expect(validateRoster({ forces, allegiance, pointsLimit }).map((w) => w.message)).toContain(
      "Herald In Terminator Armour's Logistical Benefit in Crusade Primary Detachment has no slot role chosen"
    );
  });
});
