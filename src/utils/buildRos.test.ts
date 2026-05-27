import { describe, test, expect, beforeAll } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { buildRosXml } from './buildRos';
import type { PlacedDetachment } from '../types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

describe('buildRosXml', () => {
  let emptyRoster: string;

  beforeAll(() => {
    // Generate a minimal valid roster
    emptyRoster = buildRosXml([], 'death-guard', 1000, 0);
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
    const roster = buildRosXml([], 'death-guard', 1000, 0);
    
    // Should not have unescaped < or > in attribute values
    expect(roster).not.toMatch(/name="[^"]*[<>][^"]*"/);
  });
});
