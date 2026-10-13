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
