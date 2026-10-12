import { describe, test, expect } from 'vitest';
import { createForce } from '../store/rosterModel';
import { getUnitsForFaction } from '../data/loader';
import { unitContext } from './context';
import { getPrimeOptions, isLogisticalBenefit, logisticalBenefitRoles } from './primeBenefits';
import type { Force } from '../types';

function optionsFor(faction: string, unitName: string, slotRole: string) {
  const force: Force = createForce(faction, 'primary');
  const det = force.detachments[0];
  const unit = getUnitsForFaction(faction).find((u) => u.name === unitName);
  if (!unit) throw new Error(`no ${unitName}`);
  const slot = det.def.slots.find((s) => s.role === slotRole);
  if (!slot) throw new Error(`no slot ${slotRole} in ${det.def.name}`);
  const ctx = unitContext([force], force, det, unit, slot.categoryId);
  return getPrimeOptions(unit, ctx);
}

const names = (opts: { name: string }[]) => opts.map((o) => o.name);

describe('getPrimeOptions', () => {
  test('legion units get Common benefits plus the legion benefits their slot allows', () => {
    const dg = names(optionsFor('death-guard', 'Tactical Squad', 'Prime Troops'));
    expect(dg).toEqual(expect.arrayContaining(['Combat Veterans', 'Master Sergeant', 'Logistical Benefit', 'Interdiction Cadres']));
    // Paragon of Battle needs a Command model; Special Assignment needs High Command
    expect(dg).not.toContain('Paragon of Battle');
    expect(dg).not.toContain('Special Assignment');
    // Other legions' benefits stay hidden
    expect(dg).not.toContain('Wraiths');
    expect(dg).not.toContain('Logisticae');
  });

  test('legion-specific benefits follow the army catalogue and slot', () => {
    expect(names(optionsFor('raven-guard', 'Tactical Squad', 'Prime Troops'))).toContain('Wraiths');
    expect(names(optionsFor('ultramarines', 'Centurion', 'Prime Command'))).toContain('Logisticae');
    expect(names(optionsFor('ultramarines', 'Tactical Squad', 'Prime Troops'))).not.toContain('Logisticae');
  });

  test('Knights only get Household Rank Prime Advantages', () => {
    const knight = names(optionsFor('questoris-familia', 'Knight Questoris', 'Prime Lord of War'));
    expect(knight).toEqual(expect.arrayContaining(['Seneschal', 'Lord Scion', 'Scion Martial']));
    expect(knight).not.toContain('Combat Veterans');
  });

  test('Mechanicum uses its own Logistical Benefit, not the common one', () => {
    const mech = names(optionsFor('mechanicum', 'Magos', 'Prime Command'));
    expect(mech).toEqual(expect.arrayContaining(['Logistical Benefit (Mech)', 'Paragon of Metal']));
    expect(mech).not.toContain('Logistical Benefit');
  });

  test('Logistical Benefit offers its bonus slot roles as sub-choices', () => {
    const lb = optionsFor('death-guard', 'Tactical Squad', 'Prime Troops').find(isLogisticalBenefit);
    expect(logisticalBenefitRoles(lb)).toEqual(expect.arrayContaining(['Troops', 'Armour', 'Heavy Assault']));
  });

  test('benefits carry their BSData rules text', () => {
    const vets = optionsFor('death-guard', 'Tactical Squad', 'Prime Troops').find((o) => o.name === 'Combat Veterans');
    expect(vets?.description).toMatch(/Leadership, Cool, Intelligence and Willpower/);
  });
});
