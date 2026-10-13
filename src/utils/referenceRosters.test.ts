/**
 * Round-trips the New Recruit rosters in reference_armies/: import → export,
 * then compares the export with the original at force-org level. This is the
 * check that our .ros output matches what New Recruit itself writes.
 */
import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { importRos } from './importRos';
import { buildRosXml } from './buildRos';
import { computeTotalPoints } from '../store/rosterModel';

const DIR = join(__dirname, '../../reference_armies');
const files = readdirSync(DIR).filter((f) => f.endsWith('.ros'));

interface Node {
  name?: string;
  entryId?: string;
  entryGroupId?: string;
  type?: string;
  catalogueId?: string;
  selections?: { selection?: Node[] };
  forces?: { force?: Node[] };
  costs?: { cost?: Array<{ name?: string; value?: string }> };
  categories?: { category?: Array<{ name?: string; primary?: string }> };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (n) => ['force', 'selection', 'cost', 'category', 'profile', 'rule', 'characteristic'].includes(n),
});
const parse = (xml: string) => (parser.parse(xml) as { roster: Node }).roster;
const kids = (n: Node | undefined) => n?.selections?.selection ?? [];
const cats = (n: Node) => (n.categories?.category ?? []).map((c) => `${c.primary === 'true' ? '*' : ''}${c.name}`).sort();
const unitCost = (n: Node) => Number(n.costs?.cost?.find((c) => c.name === 'Point(s)')?.value ?? 0);

/** Force-org fingerprint of a roster: what the builder is responsible for. */
function fingerprint(roster: Node, supported: (f: Node) => boolean) {
  return (roster.forces?.force ?? []).filter(supported).map((f) => ({
    entryId: f.entryId,
    catalogueId: f.catalogueId,
    allegiance: kids(f)
      .filter((s) => s.name === 'Allegiance')
      .map((s) => [s.entryId, kids(s).map((c) => c.entryId)]),
    detachments: (f.forces?.force ?? []).map((d) => ({
      entryId: d.entryId,
      units: kids(d)
        .filter((u) => u.type === 'unit')
        .map((u) => ({
          entryId: u.entryId,
          cost: unitCost(u),
          primaryCategory: cats(u).filter((c) => c.startsWith('*')),
          prime: kids(u)
            .filter((c) => c.name === 'Prime Unit')
            .map((p) => [p.entryId, cats(p), kids(p).map((b) => [b.entryId, b.entryGroupId, kids(b).map((lb) => lb.entryId)])]),
          detachmentChoice: kids(u)
            .filter((c) => /^One (Apex|Auxiliary) Detachment/.test(c.name ?? ''))
            .map((c) => [c.entryId, c.entryGroupId]),
        }))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    })),
  }));
}

describe.each(files)('%s', (file) => {
  const xml = readFileSync(join(DIR, file), 'utf-8');
  const original = parse(xml);
  const { snapshot, warnings } = importRos(xml);
  const exported = parse(
    buildRosXml(snapshot.forces, snapshot.pointsLimit, computeTotalPoints(snapshot.forces), {
      allegiance: snapshot.allegiance,
      cohortDoctrine: snapshot.cohortDoctrine,
      armyChoices: snapshot.armyChoices,
    })
  );
  const supportedIds = new Set((exported.forces?.force ?? []).map((f) => f.entryId));

  test('imports without losing units', () => {
    expect(warnings.filter((w) => !w.includes("isn't supported yet"))).toEqual([]);
  });

  test('army configuration selections carry the primary category New Recruit files them under', () => {
    for (const force of exported.forces?.force ?? []) {
      const source = (original.forces?.force ?? []).find((f) => f.entryId === force.entryId);
      for (const sel of kids(force)) {
        expect(cats(sel).filter((c) => c.startsWith('*')), sel.name).toHaveLength(1);
        const match = kids(source).find((o) => o.entryId === sel.entryId);
        if (match) expect(cats(sel).filter((c) => c.startsWith('*')), sel.name).toEqual(cats(match).filter((c) => c.startsWith('*')));
      }
    }
  });

  test('exports the same armies, detachments, units, Prime benefits and detachment choices', () => {
    const ours = fingerprint(exported, () => true);
    const theirs = fingerprint(original, (f) => supportedIds.has(f.entryId));
    if (process.env.DEBUG_ROS) {
      ours.forEach((f, i) => f.detachments.forEach((d, j) => {
        const t = theirs[i]?.detachments[j];
        if (JSON.stringify(d) !== JSON.stringify(t)) {
          d.units.forEach((u, k) => { if (JSON.stringify(u) !== JSON.stringify(t?.units[k])) console.log(file, d.entryId, '\nOURS  ', JSON.stringify(u), '\nTHEIRS', JSON.stringify(t?.units[k])); });
        }
      }));
    }
    expect(ours).toEqual(theirs);
  });

  test('army configuration entries use New Recruit paths', () => {
    const originalConfig = new Map(
      (original.forces?.force ?? []).flatMap((f) => kids(f).map((s) => [s.entryId, kids(s).map((c) => c.entryId)]))
    );
    for (const f of exported.forces?.force ?? []) {
      for (const sel of kids(f)) {
        // Everything we emit at army level exists in the original at the same path…
        expect(originalConfig.has(sel.entryId)).toBe(true);
        // …and the chosen/default children we emit are among the original's
        for (const child of kids(sel)) expect(originalConfig.get(sel.entryId)).toContain(child.entryId);
      }
    }
  });
});
