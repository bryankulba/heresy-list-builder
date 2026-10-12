import { describe, test, expect } from 'vitest';
import { addDetachment, createForce } from '../store/rosterModel';
import { getChart } from '../data/loader';
import { FACTIONS } from '../data/factions';
import { categoryFitsSlot, effectiveSlots, unitsForSlot } from './slots';
import { getUnitsForFaction } from '../data/loader';
import type { Force } from '../types';

/** Units offered for a slot of a detachment added to a fresh army. */
function offered(faction: string, detachmentName: string, slotRole: string) {
  const base = createForce(faction, 'primary');
  const chart = getChart(base.chart);
  const def = chart.detachments.find((d) => d.name === detachmentName)!;
  const forces: Force[] =
    def.name === base.detachments[0].def.name ? [base] : addDetachment([base], def, { forceId: base.id });
  const det = forces[0].detachments.find((d) => d.def.name === detachmentName)!;
  const slot = det.def.slots.find((s) => s.role === slotRole)!;
  return unitsForSlot(forces, forces[0], det, slot);
}
const names = (units: { name: string }[]) => units.map((u) => u.name);

describe('categoryFitsSlot', () => {
  test('regular slots match the category exactly', () => {
    expect(categoryFitsSlot('Troops', 'Troops', [])).toBe(true);
    expect(categoryFitsSlot('Troops', 'Troops - Tzeench only', [])).toBe(false);
    expect(categoryFitsSlot('Troops - Tzeench only', 'Troops', [])).toBe(false);
  });

  test('prime slots take the base role or a qualified variant with its own slot', () => {
    expect(categoryFitsSlot('Heavy Assault', 'Prime Heavy Assault', [])).toBe(true);
    expect(categoryFitsSlot('Heavy Assault - Tartaros Only', 'Prime Heavy Assault', ['Heavy Assault - Tartaros Only'])).toBe(true);
    expect(categoryFitsSlot('Heavy Assault - Tartaros Only', 'Prime Heavy Assault', [])).toBe(false);
  });
});

describe('unitsForSlot', () => {
  test('Linebreaker (Tartaros) qualified slots take only Tartaros units', () => {
    const ha = names(offered('death-guard', 'Apex - Linebreaker Echelon (Tartaros)', 'Heavy Assault - Tartaros Only'));
    expect(ha).toContain('Tartaros Terminator Squad');
    expect(ha).not.toContain('Cataphractii Terminator Squad');
    expect(ha).not.toContain('Breacher Squad');
    const retinue = names(offered('death-guard', 'Apex - Linebreaker Echelon (Tartaros)', 'Retinue - Tartaros Only'));
    expect(retinue).toContain('Tartaros Terminator Command Squad');
    expect(retinue).not.toContain('Praetorian Command Squad');
  });

  test('Helot Tercio troops are the Militia troops only', () => {
    expect(names(offered('solar-auxilia', 'Auxiliary - Helot Tercio', 'Troops - Infantry Troop or Levy Troop only')).sort()).toEqual([
      'Infantry Troop',
      'Levy Troop',
    ]);
  });

  test('plain slots exclude units re-filed into a qualified category', () => {
    const troops = names(offered('solar-auxilia', 'Crusade Primary Detachment', 'Troops'));
    expect(troops).toContain('Lasrifle Section');
    expect(troops).not.toContain('Infantry Troop');
  });

  test('units fill qualified slots through alternate links, exporting with that link', () => {
    const centurions = offered('death-guard', 'Auxiliary - Tactical Support', 'Command - Centurions Only');
    expect(names(centurions)).toEqual(expect.arrayContaining(['Centurion']));
    expect(names(centurions)).not.toContain('Praetor');
    const centurion = centurions.find((u) => u.name === 'Centurion')!;
    expect(centurion.primaryCategory).toBe('Command - Centurions Only');
    expect(centurion.entryId).not.toBe(
      offered('death-guard', 'Crusade Primary Detachment', 'Command').find((u) => u.name === 'Centurion')!.entryId
    );
  });

  test('Dreadnought Talon takes Contemptors via the detachment condition', () => {
    const talon = names(offered('death-guard', 'Auxiliary - Dreadnought Talon', 'War Engine - Contemptor Dreadnoughts Only'));
    expect(talon).toContain('Contemptor Dreadnought');
    expect(talon).not.toContain('Leviathan Dreadnought');
  });

  test('every qualified slot available to a faction offers units, except Centurion slots outside the Legions', () => {
    const empty: string[] = [];
    for (const f of FACTIONS) {
      const base = createForce(f.id, 'primary');
      for (const def of getChart(f.chart).detachments) {
        if (def.sources?.length && !def.sources.includes(f.id)) continue;
        const forces = def.name === base.detachments[0].def.name ? [base] : addDetachment([base], def, { forceId: base.id });
        const det = forces[0].detachments.find((d) => d.def.name === def.name)!;
        for (const slot of def.slots.filter((s) => s.role.includes(' - ') && s.max > 0)) {
          if (unitsForSlot(forces, forces[0], det, slot).length === 0) empty.push(`${f.id}: ${def.name}: ${slot.role}`);
        }
      }
    }
    expect(empty.filter((e) => !e.includes('Centurions Only'))).toEqual([]);
  });
});

describe('effectiveSlots', () => {
  const primeTroopsMax = (forces: Force[]) =>
    effectiveSlots(forces, forces[0], forces[0].detachments[0]).find((s) => s.role === 'Prime Troops')?.max;

  test('Death Guard: four Tactical Squads and a Paragon make every Troops slot Prime', () => {
    const tactical = getUnitsForFaction('death-guard').find((u) => u.name === 'Tactical Squad')!;
    const mortarion = getUnitsForFaction('death-guard').find((u) => u.name === 'Mortarion')!;
    const force = createForce('death-guard', 'primary');
    const cpd = force.detachments[0];
    cpd.slots = {
      'Prime Troops-0': { unit: tactical },
      'Troops-1': { unit: tactical },
      'Troops-2': { unit: tactical },
      'Troops-3': { unit: tactical },
    };
    expect(primeTroopsMax([force])).toBe(1);

    const warlord = getChart('Crusade Force Organization Chart').detachments.find((d) => d.name === 'Warlord Detachment')!;
    const [withWarlord] = addDetachment([force], warlord, { forceId: force.id });
    withWarlord.detachments[1].slots['Warlord-0'] = { unit: mortarion };
    expect(primeTroopsMax([withWarlord])).toBe(4);
  });

  test('slots that only open under a rule stay hidden until it applies', () => {
    const force = createForce('death-guard', 'primary');
    const roles = effectiveSlots([force], force, force.detachments[0]).map((s) => s.role);
    expect(roles).not.toContain('Retinue');
    expect(roles).not.toContain('Exemplars of the Legion - Dark Angels');
    expect(roles).toEqual(expect.arrayContaining(['High Command', 'Command', 'Troops', 'Transport']));
  });
});
