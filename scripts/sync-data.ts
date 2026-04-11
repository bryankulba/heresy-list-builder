/**
 * sync-data.ts
 * Fetches BattleScribe .cat/.gst files from the BSData GitHub repo,
 * saves raw XML to data/raw/, parses them, and writes JSON to data/parsed/.
 *
 * Run with: npm run sync-data
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseAll } from './parse-cats';

const BASE_URL =
  'https://raw.githubusercontent.com/BSData/horus-heresy-3rd-edition/main/';

const RAW_DIR = path.join(process.cwd(), 'data', 'raw');
const PARSED_DIR = path.join(process.cwd(), 'data', 'parsed');

const BASE_FILES = [
  {
    url: 'Horus%20Heresy%203rd%20Edition.gst',
    filename: 'horus-heresy-3rd-edition.gst',
    key: 'gst' as const,
  },
  {
    url: 'Legiones%20Astartes.cat',
    filename: 'legiones-astartes.cat',
    key: 'la' as const,
  },
];

const LEGION_FILES: Array<{ url: string; filename: string; factionKey: string }> = [
  { url: 'Alpha%20Legion.cat',           filename: 'alpha-legion.cat',       factionKey: 'alpha-legion' },
  { url: 'Blood%20Angels.cat',           filename: 'blood-angels.cat',       factionKey: 'blood-angels' },
  { url: 'Dark%20Angels.cat',            filename: 'dark-angels.cat',        factionKey: 'dark-angels' },
  { url: 'Death%20Guard.cat',            filename: 'death-guard.cat',        factionKey: 'death-guard' },
  { url: 'Emperor%27s%20Children.cat',   filename: 'emperors-children.cat',  factionKey: 'emperors-children' },
  { url: 'Imperial%20Fists.cat',         filename: 'imperial-fists.cat',     factionKey: 'imperial-fists' },
  { url: 'Iron%20Hands.cat',             filename: 'iron-hands.cat',         factionKey: 'iron-hands' },
  { url: 'Iron%20Warriors.cat',          filename: 'iron-warriors.cat',      factionKey: 'iron-warriors' },
  { url: 'Night%20Lords.cat',            filename: 'night-lords.cat',        factionKey: 'night-lords' },
  { url: 'Raven%20Guard.cat',            filename: 'raven-guard.cat',        factionKey: 'raven-guard' },
  { url: 'Salamanders.cat',              filename: 'salamanders.cat',        factionKey: 'salamanders' },
  { url: 'Sons%20of%20Horus.cat',        filename: 'sons-of-horus.cat',      factionKey: 'sons-of-horus' },
  { url: 'Space%20Wolves.cat',           filename: 'space-wolves.cat',       factionKey: 'space-wolves' },
  { url: 'Thousand%20Sons.cat',          filename: 'thousand-sons.cat',      factionKey: 'thousand-sons' },
  { url: 'Ultramarines.cat',             filename: 'ultramarines.cat',       factionKey: 'ultramarines' },
  { url: 'White%20Scars.cat',            filename: 'white-scars.cat',        factionKey: 'white-scars' },
  { url: 'Word%20Bearers.cat',           filename: 'word-bearers.cat',       factionKey: 'word-bearers' },
  { url: 'World%20Eaters.cat',           filename: 'world-eaters.cat',       factionKey: 'world-eaters' },
  { url: 'Mechanicum.cat',               filename: 'mechanicum.cat',          factionKey: 'mechanicum' },
  { url: 'Solar%20Auxilia.cat',          filename: 'solar-auxilia.cat',       factionKey: 'solar-auxilia' },
];

async function fetchFile(url: string): Promise<string> {
  const fullUrl = BASE_URL + url;
  console.log(`  Fetching ${fullUrl}`);
  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${fullUrl}`);
  }
  return response.text();
}

async function main(): Promise<void> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(PARSED_DIR, { recursive: true });

  const xmlMap: Record<string, string> = {};

  console.log('=== Fetching base files ===');
  for (const file of BASE_FILES) {
    const xml = await fetchFile(file.url);
    const filePath = path.join(RAW_DIR, file.filename);
    fs.writeFileSync(filePath, xml, 'utf-8');
    const kb = Math.round(xml.length / 1024);
    console.log(`  Saved ${file.filename} (${kb} KB)`);
    xmlMap[file.key] = xml;
  }

  console.log('\n=== Fetching legion catalogs ===');
  const factionCats: Record<string, string> = {};
  for (const file of LEGION_FILES) {
    const xml = await fetchFile(file.url);
    const filePath = path.join(RAW_DIR, file.filename);
    fs.writeFileSync(filePath, xml, 'utf-8');
    const kb = Math.round(xml.length / 1024);
    console.log(`  Saved ${file.filename} (${kb} KB)`);
    factionCats[file.factionKey] = xml;
  }

  console.log('\n=== Parsing ===');
  const { units, detachments, warnings } = parseAll(
    xmlMap['gst'],
    xmlMap['la'],
    factionCats
  );

  const unitsPath = path.join(PARSED_DIR, 'units.json');
  const detachmentsPath = path.join(PARSED_DIR, 'detachments.json');

  fs.writeFileSync(unitsPath, JSON.stringify(units, null, 2), 'utf-8');
  fs.writeFileSync(detachmentsPath, JSON.stringify(detachments, null, 2), 'utf-8');

  console.log(`  Wrote ${unitsPath}`);
  console.log(`  Wrote ${detachmentsPath}`);

  // Summary
  const coreCount = detachments.core.length;
  const auxCount = detachments.auxiliary.length;
  const apexCount = detachments.apex.length;
  const legionCount = Object.values(detachments.legion).flat().length;
  const totalDetachments = coreCount + auxCount + apexCount + legionCount;

  console.log('\n=== Summary ===');
  console.log(`Legiones Astartes units:   ${units['legiones-astartes'].length}`);
  for (const file of LEGION_FILES) {
    const count = units[file.factionKey]?.length ?? 0;
    console.log(`  ${file.factionKey}: ${count} faction-specific units`);
  }
  console.log(`\nDetachment types found:     ${[coreCount > 0 && 'core', auxCount > 0 && 'auxiliary', apexCount > 0 && 'apex'].filter(Boolean).join(', ')}`);
  console.log(`  Core:      ${coreCount}`);
  console.log(`  Auxiliary: ${auxCount}`);
  console.log(`  Apex:      ${apexCount}`);
  console.log(`  Legion:    ${legionCount}`);
  console.log(`  Total:     ${totalDetachments}`);

  if (warnings.length > 0) {
    console.warn(`\nWarnings (${warnings.length}) — units needing manual review:`);
    for (const w of warnings) {
      console.warn(`  ! ${w}`);
    }
  } else {
    console.log('\nNo warnings — all units resolved cleanly.');
  }

  // ── Points sanity check ───────────────────────────────────────────────────
  console.log('\n=== Points Validation ===');
  const allUnits = Object.entries(units).flatMap(([src, arr]) =>
    arr.map(u => ({ ...u, src }))
  );

  let anomalies = 0;
  for (const u of allUnits) {
    if (u.points === 0) {
      console.log(`  ℹ️  ${u.name} (${u.src}): 0pts — free unit or parse miss`);
      anomalies++;
    } else if (u.points < 10) {
      console.warn(`  ⚠️  ${u.name} (${u.src}): ${u.points}pts — check manually`);
      anomalies++;
    } else if (u.points > 1000) {
      console.log(`  ℹ️  ${u.name} (${u.src}): ${u.points}pts — likely Primarch/LoW, confirm manually`);
      anomalies++;
    }
  }

  if (anomalies === 0) {
    console.log('  All units passed (10–1000pts range).');
  } else {
    console.log(`  ${anomalies} unit(s) flagged above.`);
  }
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
