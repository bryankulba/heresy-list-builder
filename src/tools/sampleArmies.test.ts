/**
 * The sample armies build cleanly (no roster warnings) and round-trip through
 * import. With WRITE_SAMPLES=1 (`npm run samples`) their .ros files are written
 * to sample_exports/ for checking in New Recruit.
 */
import { describe, test, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SAMPLE_SPECS, buildSampleArmy, sampleRos } from './sampleArmies';
import { validateRoster } from '../rules/validate';
import { importRos } from '../utils/importRos';
import { computeTotalPoints } from '../store/rosterModel';

const OUT = join(__dirname, '../../sample_exports');

describe.each(SAMPLE_SPECS)('$file', (spec) => {
  const army = buildSampleArmy(spec);

  test('builds within the points limit, without warnings', () => {
    const total = computeTotalPoints(army.forces);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(spec.pointsLimit);
    const warnings = validateRoster({
      forces: army.forces,
      allegiance: spec.allegiance,
      pointsLimit: spec.pointsLimit,
      cohortDoctrine: army.cohortDoctrine,
      configChoices: army.configChoices,
    });
    expect(warnings.map((w) => w.message)).toEqual([]);
  });

  test('exports and imports back the same detachments and units', () => {
    const xml = sampleRos(army);
    const { snapshot, warnings } = importRos(xml);
    expect(warnings.filter((w) => !w.includes("isn't supported yet"))).toEqual([]);
    const shape = (forces: typeof army.forces) =>
      forces.map((f) => f.detachments.map((d) => [d.def.name, Object.values(d.slots).filter(Boolean).length]));
    expect(shape(snapshot.forces)).toEqual(shape(army.forces));
    expect(computeTotalPoints(snapshot.forces)).toBe(computeTotalPoints(army.forces));

    if (process.env.WRITE_SAMPLES) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(join(OUT, `${spec.file}.ros`), xml);
    }
  });
});
