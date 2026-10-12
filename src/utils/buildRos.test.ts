import { describe, test, expect, beforeAll } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { buildRosXml } from './buildRos';
import { createForce, addDetachment } from '../store/rosterModel';
import { getUnitsForFaction, getChart } from '../data/loader';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

describe('buildRosXml', () => {
  let emptyRoster: string;

  beforeAll(() => {
    // Generate a minimal valid roster
    emptyRoster = buildRosXml([createForce('death-guard', 'primary')], 1000, 0);
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
    expect(emptyRoster).toContain('pointsLimit="1000"');
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
    expect(emptyRoster).toContain('points="0"');
    // Should have costs element with value 0
    expect(emptyRoster).toContain('<cost name="pts" value="0"');
  });

  test('escapes XML special characters in names', () => {
    // Test with a faction that has special characters
    const roster = buildRosXml([createForce('death-guard', 'primary')], 1000, 0);
    
    // Should not have unescaped < or > in attribute values
    expect(roster).not.toMatch(/name="[^"]*[<>][^"]*"/);
  });

  test('emits one root force per army, each with its own catalogue', () => {
    const primary = createForce('death-guard', 'primary');
    const allies = createForce('mechanicum', 'allied');
    const xml = buildRosXml([primary, allies], 3000, 0);
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
    const roots = [xmlParser.parse(buildRosXml(forces, 3000, 0)).roster.forces.force].flat();
    const alliedChildren = [roots[1].forces.force].flat().map((f: Record<string, string>) => f['@_name']);
    expect(alliedChildren).toEqual(['Allied Detachment', 'Auxiliary - Armoured Fist']);
  });

  test('filled slots export the unit with its category', () => {
    const force = createForce('death-guard', 'primary');
    const unit = getUnitsForFaction('death-guard').find((u) => u.role === 'Troops')!;
    force.detachments[0].slots['Troops-1'] = { unit };
    const xml = buildRosXml([force], 3000, unit.points);
    expect(xml).toContain(`entryId="${unit.entryId}"`);
    expect(xml).toContain('name="Troops" primary="true"');
  });
});
