import { describe, test, expect } from 'vitest';
import { createForce } from '../store/rosterModel';
import { getChart, getDetachmentsForFaction, getAdditionalDetachments, getUnitsForFaction } from '../data/loader';
import { rosterCounts, unitContext } from './context';
import { detachmentAvailability, fillableSlots } from './options';
import { getPrimeOptions } from './primeBenefits';
import { doctrineOptions, normalizeDoctrine } from './armyConfig';

const availability = (faction: string, name: string, type: 'auxiliary' | 'additional' = 'auxiliary', opts = {}) => {
  const force = createForce(faction, 'primary');
  const defs = type === 'additional' ? getAdditionalDetachments(force.chart, faction) : getDetachmentsForFaction(type, faction);
  const def = defs.find((d) => d.name === name)!;
  return detachmentAvailability([force], force, def, rosterCounts([force], opts));
};

describe('choices offered', () => {
  test("detachments the army can't fill are hidden; ones a unit unlocks are dimmed with the reason", () => {
    expect(availability('skitarii-conclaves', 'Auxiliary - Shock Assault').status).toBe('hidden');
    expect(availability('death-guard', 'Auxiliary - Storm Battery')).toEqual({
      status: 'locked',
      reason: 'Storm Battery Detachment requires a Siege Breaker',
    });
    expect(availability('solar-auxilia', 'Auxiliary - Armour Tercio')).toEqual({
      status: 'locked',
      reason: 'Unlocked by Armoured Command Section or Dracosan Command Tank',
    });
    expect(availability('questoris-familia', 'Additional - Armiger Talon', 'additional')).toEqual({
      status: 'locked',
      reason: 'Unlocked by the Scion Aspirant Prime benefit',
    });
    expect(availability('death-guard', 'Auxiliary - Armoured Support').status).toBe('ok');
  });

  test('slot roles no unit can fill are left off the card (Skitarii have no Transport)', () => {
    const force = createForce('skitarii-conclaves', 'primary');
    const roles = fillableSlots([force], force, force.detachments[0], rosterCounts([force])).map((s) => s.role);
    expect(roles).not.toContain('Transport');
    expect(roles).not.toContain('High Command');
    expect(roles).toContain('Troops');
  });

  test('Prime benefits follow the allegiance', () => {
    const force = createForce('death-guard', 'primary');
    const det = force.detachments[0];
    const unit = getUnitsForFaction('death-guard').find((u) => u.name === 'Assault Squad')!;
    const slot = det.def.slots.find((s) => s.role === 'Prime Troops')!;
    const names = (allegiance: 'Loyalist' | 'Traitor') =>
      getPrimeOptions(unit, unitContext([force], force, det, unit, slot.categoryId, rosterCounts([force], { allegiance }))).map((o) => o.name);
    expect(names('Loyalist')).toContain('Clade Operative');
    expect(names('Loyalist')).not.toContain('Cult Operative');
    expect(names('Traitor')).toContain('Cult Operative');
  });

  test('cohort doctrines come from BSData; old saved slugs are recognised', () => {
    expect(doctrineOptions('solar-auxilia')).toContain('Cohort Doctrine: Mechanised Pattern Cohort');
    expect(doctrineOptions('death-guard')).toEqual([]);
    expect(normalizeDoctrine('mechanised-pattern')).toBe('Cohort Doctrine: Mechanised Pattern Cohort');
    expect(getChart('Crusade Force Organization Chart')).toBeTruthy();
  });
});

describe('Assassins and Cult Operatives', () => {
  test('Clade Operative opens 3 slots for Assassins (Loyalist); Cult Operative 1 for the Abomination (Traitor)', async () => {
    const { withEffectiveSlots, unitsForSlot } = await import('./slots');
    for (const [allegiance, benefit, max, unit] of [
      ['Loyalist', 'Clade Operative', 3, 'Vindicare Assassin'],
      ['Traitor', 'Cult Operative', 1, 'Infernus Abomination'],
    ] as const) {
      const force = createForce('death-guard', 'primary');
      const det = force.detachments[0];
      const tactical = getUnitsForFaction('death-guard').find((u) => u.name === 'Tactical Squad')!;
      const slot = det.def.slots.find((s) => s.role === 'Prime Troops')!;
      expect(withEffectiveSlots([force], rosterCounts([force], { allegiance }))[0].detachments[0].def.slots.some((s) => s.role === benefit)).toBe(false);
      const opt = getPrimeOptions(tactical, unitContext([force], force, det, tactical, slot.categoryId, rosterCounts([force], { allegiance }))).find((o) => o.name === benefit)!;
      det.slots['Prime Troops-0'] = { unit: tactical, primeBenefit: { id: opt.id, name: opt.name, description: opt.description } };
      const counts = rosterCounts([force], { allegiance });
      const opened = withEffectiveSlots([force], counts)[0].detachments[0].def.slots.find((s) => s.role === benefit)!;
      expect(opened.max).toBe(max);
      expect(unitsForSlot([force], force, det, opened, counts).map((u) => u.name)).toContain(unit);
    }
  });
});

describe('army settings', () => {
  test('Rite of War, Household Paradigm and other single-choice settings come from BSData', async () => {
    const { configOptions, defaultConfigChoices } = await import('./armyConfig');
    expect(configOptions('emperors-children').find((o) => o.name === 'Rite of War')?.choices).toEqual([
      "Legiones Astartes Emperor's Children",
      "Legiones Hereticus Emperor's Children",
    ]);
    expect(defaultConfigChoices('questoris-familia')).toEqual({ 'Household Paradigms': 'Questoris Imperialis' });
    expect(configOptions('solar-auxilia')).toEqual([]); // designation and Provenances of War are optional
    expect(configOptions('death-guard')).toEqual([]); // one Rite of War only
  });

  test('the export writes the chosen settings, and every choice when all are required (Knights reactions)', async () => {
    const { buildRosXml } = await import('../utils/buildRos');
    const { importRos } = await import('../utils/importRos');
    const knights = createForce('questoris-familia', 'primary');
    const xml = buildRosXml([knights], 3000, 0, { allegiance: 'Loyalist', configChoices: { 'Household Paradigms': 'Questoris Mechanicum' } });
    for (const reaction of ['Stomp', 'Joust!', 'Rotate Ion Shields']) expect(xml).toContain(`name="${reaction}"`);
    expect(importRos(xml).snapshot.configChoices).toEqual({ 'Household Paradigms': 'Questoris Mechanicum' });
  });
});
