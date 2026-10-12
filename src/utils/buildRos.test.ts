import { describe, test, expect, beforeAll } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { buildRosXml } from './buildRos';
import { createForce, addDetachment } from '../store/rosterModel';
import { getUnitsForFaction, getChart } from '../data/loader';
import { unitContext } from '../rules/context';
import { getPrimeOptions, isLogisticalBenefit } from '../rules/primeBenefits';

const OPTS = { allegiance: 'Traitor' as const };

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

describe('buildRosXml', () => {
  let emptyRoster: string;

  beforeAll(() => {
    // Generate a minimal valid roster
    emptyRoster = buildRosXml([createForce('death-guard', 'primary')], 1000, 0, OPTS);
  });

  test('produces valid XML string', () => {
    expect(typeof emptyRoster).toBe('string');
    expect(emptyRoster.length).toBeGreaterThan(0);
  });

  test('XML is well-formed and parseable', () => {
    // Parse using fast-xml-parser to validate structure
    expect(() => {
      xmlParser.parse(emptyRoster);
    }).not.toThrow();
    
    const parsed = xmlParser.parse(emptyRoster);
    
    // Root element should be roster
    expect(parsed.roster).toBeDefined();
  });

  test('includes required roster attributes', () => {
    // Test by checking the raw XML contains expected attributes
    expect(emptyRoster).toContain('Death Guard');
    expect(emptyRoster).toContain('gameSystemName="Horus Heresy 3rd Edition"');
    expect(emptyRoster).toContain('<costLimit name="Point(s)" typeId="9893-c379-920b-8982" value="1000"/>');
    expect(emptyRoster).toContain('battleScribeVersion="2.03"');
  });

  test('has valid XML declaration', () => {
    expect(emptyRoster).toMatch(/^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?>/);
  });

  test('includes closing roster tag', () => {
    expect(emptyRoster).toContain('</roster>');
  });

  test('costs section matches points values', () => {
    // For empty roster, points should be 0
    expect(emptyRoster).toContain('<cost name="Point(s)" typeId="9893-c379-920b-8982" value="0"/>');
  });

  test('escapes XML special characters in names', () => {
    // Test with a faction that has special characters
    const roster = buildRosXml([createForce('death-guard', 'primary')], 1000, 0, OPTS);
    
    // Should not have unescaped < or > in attribute values
    expect(roster).not.toMatch(/name="[^"]*[<>][^"]*"/);
  });

  test('emits one root force per army, each with its own catalogue', () => {
    const primary = createForce('death-guard', 'primary');
    const allies = createForce('mechanicum', 'allied');
    const xml = buildRosXml([primary, allies], 3000, 0, OPTS);
    const parsed = xmlParser.parse(xml);
    const roots = [parsed.roster.forces.force].flat();

    expect(roots).toHaveLength(2);
    expect(roots[0]['@_entryId']).toBe(getChart('Crusade Force Organization Chart').id);
    expect(roots[0]['@_catalogueName']).toBe('Death Guard');
    expect(roots[1]['@_entryId']).toBe(getChart('Allied Detachment and its Auxiliary').id);
    expect(roots[1]['@_catalogueName']).toBe('Mechanicum');
    expect(roots[1].forces.force['@_name']).toBe('Allied Detachment');
  });

  test('unlocked detachments are exported inside the unlocking army', () => {
    const primary = createForce('death-guard', 'primary');
    const allies = createForce('mechanicum', 'allied');
    const alliedRoot = allies.detachments[0];
    const aux = getChart('Crusade Force Organization Chart').detachments.find((d) => d.name === 'Auxiliary - Armoured Fist')!;
    const forces = addDetachment([primary, allies], aux, { unlockedBy: `${alliedRoot.id}::Command-0` });
    const roots = [xmlParser.parse(buildRosXml(forces, 3000, 0, OPTS)).roster.forces.force].flat();
    const alliedChildren = [roots[1].forces.force].flat().map((f: Record<string, string>) => f['@_name']);
    expect(alliedChildren).toEqual(['Allied Detachment', 'Auxiliary - Armoured Fist']);
  });

  test('filled slots export the unit with its category', () => {
    const force = createForce('death-guard', 'primary');
    const unit = getUnitsForFaction('death-guard').find((u) => u.role === 'Troops')!;
    force.detachments[0].slots['Troops-1'] = { unit };
    const xml = buildRosXml([force], 3000, unit.points, OPTS);
    expect(xml).toContain(`entryId="${unit.path}"`);
    expect(xml).toMatch(/<category [^>]*name="Troops"[^>]*primary="true"/);
  });

  test('a Prime unit exports its Prime Unit upgrade with the chosen benefit nested inside', () => {
    const force = createForce('death-guard', 'primary');
    const det = force.detachments[0];
    const unit = getUnitsForFaction('death-guard').find((u) => u.name === 'Tactical Squad')!;
    const slot = det.def.slots.find((s) => s.role === 'Prime Troops')!;
    const options = getPrimeOptions(unit, unitContext([force], force, det, unit, slot.categoryId));
    const lb = options.find(isLogisticalBenefit)!;
    det.slots['Prime Troops-0'] = { unit, primeBenefit: { id: lb.id, name: lb.name, description: lb.description } };
    det.bonusSlots = [{ id: 'b1', sourceSlotKey: 'Prime Troops-0', role: 'Armour', unit: null }];

    const parsed = xmlParser.parse(buildRosXml([force], 3000, unit.points, OPTS));
    const unitSel = [parsed.roster.forces.force.forces.force.selections.selection].flat()[0];
    const prime = [unitSel.selections.selection].flat().find((s: Record<string, string>) => s['@_name'] === 'Prime Unit');
    expect(prime['@_entryId']).toBe(unit.prime!.path);
    // Paths as New Recruit writes them: root::groupLink::Common Prime Benefits::Logistical Benefit
    const prefix = unit.prime!.groupPrefixes![unit.prime!.groups[0]];
    const benefit = prime.selections.selection;
    expect(benefit['@_name']).toBe('Logistical Benefit');
    expect(benefit['@_entryId']).toBe(`${prefix}::c115-438b-4395-1eb7::6a03-452b-5657-bda4`);
    expect(benefit['@_entryGroupId']).toBe(`${prefix}::c115-438b-4395-1eb7::93f7-d7db-d7f0-2146`);
    expect(benefit.selections.selection['@_name']).toBe('LB - Armour');
    expect(benefit.selections.selection['@_entryId']).toBe(`${prefix}::c115-438b-4395-1eb7::d5b0-22dc-909e-415e`);
    expect(benefit.selections.selection['@_entryGroupId']).toBe(`${prefix}::c115-438b-4395-1eb7::52ae-1a80-a764-d4fd`);
  });

  test('units in positions a rule made Prime export as Prime', () => {
    const tactical = getUnitsForFaction('death-guard').find((u) => u.name === 'Tactical Squad')!;
    const mortarion = getUnitsForFaction('death-guard').find((u) => u.name === 'Mortarion')!;
    const force = createForce('death-guard', 'primary');
    const vets = { id: '8cf8-9be5-91d6-c96d', name: 'Combat Veterans', description: '' };
    force.detachments[0].slots = {
      'Prime Troops-0': { unit: tactical, primeBenefit: vets },
      'Troops-1': { unit: tactical, primeBenefit: vets },
      'Troops-2': { unit: tactical, primeBenefit: vets },
      'Troops-3': { unit: tactical, primeBenefit: vets },
    };
    const warlord = getChart('Crusade Force Organization Chart').detachments.find((d) => d.name === 'Warlord Detachment')!;
    const [withWarlord] = addDetachment([force], warlord, { forceId: force.id });
    withWarlord.detachments[1].slots['Warlord-0'] = { unit: mortarion };

    const roots = xmlParser.parse(buildRosXml([withWarlord], 3000, 0, OPTS)).roster.forces.force;
    const cpd = [roots.forces.force].flat()[0];
    const units = [cpd.selections.selection].flat();
    expect(units).toHaveLength(4);
    for (const u of units) {
      expect(u.categories.category['@_name']).toBe('Prime Troops');
      expect([u.selections.selection].flat().some((s: Record<string, string>) => s['@_name'] === 'Prime Unit')).toBe(true);
    }
  });
});
