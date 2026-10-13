import { describe, test, expect } from 'vitest';
import { buildRosXml } from './buildRos';
import { importRos } from './importRos';
import { createForce } from '../store/rosterModel';
import { getUnitsForFaction } from '../data/loader';
import { armyChoiceGroups, armyChoiceLabel } from '../rules/armyChoices';

describe('army-wide sub-faction', () => {
  const group = armyChoiceGroups('skitarii-conclaves')[0];
  const expurgator = group.options.find((o) => o.name === 'Expurgator')!;

  test('Skitarii and Mechanicum armies pick a sub-faction; options hidden for the army are left out', () => {
    // The Skitarii's own sub-faction first; Mechanicum's (on units like the Triaros) after
    expect(armyChoiceGroups('skitarii-conclaves').map(armyChoiceLabel)).toEqual(['Skitarii sub-faction', 'Mechanicum sub-faction']);
    expect(group.options.map((o) => o.name)).toContain('Acquisitor');
    const mech = armyChoiceGroups('mechanicum')[0];
    expect(mech.options.map((o) => o.name)).toContain('Macrotek');
    // Macrotek is only offered to Mechanicum armies
    expect(armyChoiceGroups('solar-auxilia').flatMap((g) => g.options.map((o) => o.name))).not.toContain('Macrotek');
    expect(armyChoiceGroups('death-guard')).toEqual([]);
  });

  test('the pick is exported on every unit and read back on import', () => {
    const units = getUnitsForFaction('skitarii-conclaves');
    const marshal = units.find((u) => u.name === 'Skitarii Battle-Pilgrym Marshal')!;
    const vultarax = units.find((u) => u.name === 'Skitarii Vultarax Stratos-Automata')!;
    const force = createForce('skitarii-conclaves', 'primary');
    force.detachments[0].slots = { 'Command-0': { unit: marshal }, 'Fast Attack-0': { unit: vultarax } };

    const xml = buildRosXml([force], 3000, 0, { allegiance: 'Loyalist', armyChoices: { [group.id]: expurgator.id } });
    expect(xml).not.toContain('name="Acquisitor"');
    expect(xml.match(/name="Expurgator"/g)).toHaveLength(2);
    // Paths keep each unit's own prefix (the Vultarax's sits on its root link)
    expect(xml).toContain(`entryId="abd3-c1ac-17be-9d21::${expurgator.id}"`);

    expect(importRos(xml).snapshot.armyChoices).toEqual({ [group.id]: expurgator.id });
  });
});
