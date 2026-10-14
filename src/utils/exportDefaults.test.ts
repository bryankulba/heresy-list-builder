/**
 * Export fixes from New Recruit's reports on the generated sample armies
 * (sample_exports/export_errors.md).
 */
import { describe, test, expect } from 'vitest';
import { getDetachmentsForFaction, getUnitsForFaction } from '../data/loader';
import { addDetachment, createForce, updateDetachment, modelKey } from '../store/rosterModel';
import { buildRosXml } from './buildRos';
import { benefitLimitReached, getPrimeOptions } from '../rules/primeBenefits';
import { unitContext } from '../rules/context';
import { validateRoster } from '../rules/validate';
import type { FilledSlot, Force } from '../types';

const unit = (faction: string, name: string) => getUnitsForFaction(faction).find((u) => u.name === name)!;

function army(faction: string, slots: Record<string, FilledSlot>): Force[] {
  const force = createForce(faction, 'primary');
  return updateDetachment([force], force.detachments[0].id, (d) => ({ ...d, slots: { ...d.slots, ...slots } }));
}
const xmlOf = (forces: Force[]) => buildRosXml(forces, 3000, 0, { allegiance: 'Traitor' });

describe('export defaults New Recruit accepts', () => {
  test("a sub-unit's models are totals across them (two Rapier crews: 4 Legionaries, 2 Carriers)", () => {
    const rapier = unit('death-guard', 'Rapier Battery');
    const crew = rapier.models[0];
    const forces = army('death-guard', { 'Troops-0': { unit: rapier, modelCounts: { [modelKey(crew)]: 2 } } });
    const xml = xmlOf(forces);
    expect(xml).toMatch(/name="Rapier Crew"[^>]*number="2"/);
    expect(xml).toMatch(/name="Legionary"[^>]*number="4"/);
    expect(xml).toMatch(/name="Rapier Carrier"[^>]*number="2"/);
  });

  test("Iron Warriors Legionaries take their Legion's required exchange; other Legions the standard weapons", () => {
    const legionaryWargear = (faction: string) =>
      unit(faction, 'Tactical Squad').models.find((m) => m.name === 'Legionary')!.defaultWargear.map((w) => w.path);
    const iw = legionaryWargear('iron-warriors');
    const dg = legionaryWargear('death-guard');
    expect(iw).toHaveLength(2);
    expect(iw).not.toEqual(dg);
    // The standard pistol / bolter paths are the ones BSData hides for Iron Warriors
    for (const path of iw) expect(dg).not.toContain(path);
  });

  test('a group requiring two picks gets two (Saturnine Praetor: two melee weapons)', () => {
    const praetor = unit('death-guard', 'Praetor in Saturnine Terminator Armour');
    const melee = praetor.models[0].defaultWargear.filter((w) => /^Saturnine (war axe|disruption fist|concussion hammer)/.test(w.name));
    expect(melee).toHaveLength(2);
  });
});

describe('BSData limits on Prime benefits', () => {
  test('Seneschal is once per army: offered until one Knight has it, then a warning if taken again', () => {
    const knight = unit('questoris-familia', 'Knight Questoris');
    const force = createForce('questoris-familia', 'primary');
    const det = force.detachments[0];
    const primeKey = Object.keys({ ...det.def.slots.reduce((o, s) => ({ ...o, [`${s.role}-0`]: 1 }), {}) }).find((k) => k.startsWith('Prime'))!;
    const seneschal = getPrimeOptions(knight, unitContext([force], force, det, knight, undefined)).find((o) => o.name === 'Seneschal')!;
    expect(seneschal.max).toEqual({ roster: 1 });
    expect(benefitLimitReached([force], seneschal, det.id, primeKey)).toBe(false);

    const benefit = { id: seneschal.id, name: seneschal.name, description: '' };
    const one = updateDetachment([force], det.id, (d) => ({ ...d, slots: { ...d.slots, [primeKey]: { unit: knight, primeBenefit: benefit } } }));
    expect(benefitLimitReached(one, seneschal, det.id, 'Other-0')).toBe(true);
    // …but not for the slot that already holds it (editing it)
    expect(benefitLimitReached(one, seneschal, det.id, primeKey)).toBe(false);

    const two = updateDetachment(one, det.id, (d) => ({ ...d, slots: { ...d.slots, 'Other-0': { unit: knight, primeBenefit: benefit } } }));
    const warnings = validateRoster({ forces: two, allegiance: 'Loyalist', pointsLimit: 5000 });
    expect(warnings.some((w) => w.message === 'Seneschal may only be taken once per army')).toBe(true);
  });
});

describe("BSData's detachment errors", () => {
  test('mixing Mechanicum Traits in one detachment is a warning', () => {
    // Thallax carry Reductor, Castellax Cybernetica — two Traits in one Tactical Support
    const thallax = unit('mechanicum', 'Thallax Cohort');
    const castellax = unit('mechanicum', 'Castellax Battle Maniple');
    const base = createForce('mechanicum', 'primary');
    const tactical = getDetachmentsForFaction('auxiliary', 'mechanicum').find((d) => d.name === 'Auxiliary - Tactical Support')!;
    const added = addDetachment([base], tactical, { forceId: base.id });
    const det = added[0].detachments[1];
    const forces = updateDetachment(added, det.id, (d) => ({
      ...d,
      slots: { ...d.slots, 'Support-0': { unit: thallax }, 'Support-1': { unit: castellax } },
    }));
    const warnings = validateRoster({ forces, allegiance: 'Traitor', pointsLimit: 3000 });
    expect(warnings.some((w) => /Multiple Mechanicum Traits/.test(w.message))).toBe(true);
  });
});
