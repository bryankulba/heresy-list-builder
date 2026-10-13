/**
 * sync-data.ts
 * Fetches the BSData Horus Heresy 3rd Edition JSON files from GitHub, saves
 * them to data/raw/, parses them, and writes the app's data to data/parsed/.
 *
 *   npm run sync-data                      # latest BSData main
 *   BSDATA_REF=<sha|branch|tag> npm run sync-data   # pin a specific upstream version
 *   npm run sync-data -- --offline         # re-parse data/raw/ without fetching
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseAll, type BsCatalogueFile, type BsGameSystemFile } from './parse-bsdata';

const REPO = 'BSData/horus-heresy-3rd-edition';
const GAME_SYSTEM_FILE = 'Horus Heresy 3rd Edition.json';

const RAW_DIR = path.join(process.cwd(), 'data', 'raw');
const PARSED_DIR = path.join(process.cwd(), 'data', 'parsed');
const SOURCE_FILE = path.join(RAW_DIR, 'source.json');

/**
 * Factions whose units are extracted into units.json. Keys are the slugified
 * BSData catalogue names (see factionKeyForCatalogue). Legiones Astartes is the
 * shared base merged into every legion at runtime (src/data/loader.ts).
 */
const UNIT_FACTIONS = [
  'legiones-astartes',
  'alpha-legion',
  'blood-angels',
  'dark-angels',
  'death-guard',
  'emperors-children',
  'imperial-fists',
  'iron-hands',
  'iron-warriors',
  'night-lords',
  'raven-guard',
  'salamanders',
  'sons-of-horus',
  'space-wolves',
  'thousand-sons',
  'ultramarines',
  'white-scars',
  'word-bearers',
  'world-eaters',
  'mechanicum',
  'solar-auxilia',
  // 1.0 additions — data available ahead of the app supporting them
  'skitarii-conclaves',
  'legio-custodes',
  'anathema-psykana',
  'questoris-familia',
];

interface SourceInfo {
  repo: string;
  ref: string;
  commit: string;
  commitDate: string;
  fetchedAt: string;
}

async function getJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  return (await response.json()) as T;
}

async function getText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

/** Resolves the ref to a commit and downloads every root-level .json file at that commit. */
async function fetchRaw(ref: string): Promise<SourceInfo> {
  console.log(`=== Resolving ${REPO}@${ref} ===`);
  const commit = await getJson<{ sha: string; commit: { committer: { date: string } } }>(
    `https://api.github.com/repos/${REPO}/commits/${encodeURIComponent(ref)}`
  );
  console.log(`  commit ${commit.sha} (${commit.commit.committer.date})`);

  const tree = await getJson<{ tree: Array<{ path: string; type: string }> }>(
    `https://api.github.com/repos/${REPO}/git/trees/${commit.sha}`
  );
  const files = tree.tree.filter((t) => t.type === 'blob' && t.path.endsWith('.json')).map((t) => t.path);
  if (!files.includes(GAME_SYSTEM_FILE)) {
    throw new Error(`${GAME_SYSTEM_FILE} not found at ${commit.sha} — has the upstream format changed again?`);
  }

  console.log(`\n=== Fetching ${files.length} files ===`);
  fs.rmSync(RAW_DIR, { recursive: true, force: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });
  for (const file of files) {
    const text = await getText(
      `https://raw.githubusercontent.com/${REPO}/${commit.sha}/${encodeURIComponent(file)}`
    );
    fs.writeFileSync(path.join(RAW_DIR, file), text, 'utf-8');
    console.log(`  ${file} (${Math.round(text.length / 1024)} KB)`);
  }

  const source: SourceInfo = {
    repo: REPO,
    ref,
    commit: commit.sha,
    commitDate: commit.commit.committer.date,
    fetchedAt: new Date().toISOString(),
  };
  fs.writeFileSync(SOURCE_FILE, JSON.stringify(source, null, 2), 'utf-8');
  return source;
}

function readRaw(): { gameSystem: BsGameSystemFile; catalogues: BsCatalogueFile[]; source: SourceInfo } {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`No data in ${RAW_DIR} — run without --offline first.`);
  }
  const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith('.json') && f !== 'source.json');
  const load = (f: string) => JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), 'utf-8'));
  return {
    gameSystem: load(GAME_SYSTEM_FILE),
    catalogues: files.filter((f) => f !== GAME_SYSTEM_FILE).map(load),
    source: load('source.json'),
  };
}

function writeJson(file: string, data: unknown): void {
  const full = path.join(PARSED_DIR, file);
  fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  Wrote ${path.relative(process.cwd(), full)}`);
}

async function main(): Promise<void> {
  const offline = process.argv.includes('--offline');
  if (!offline) await fetchRaw(process.env.BSDATA_REF ?? 'main');

  const { gameSystem, catalogues, source } = readRaw();

  console.log('\n=== Parsing ===');
  const { units, detachments, system, catalogues: catalogueInfo, rules, warnings } = parseAll({
    gameSystem,
    catalogues,
    unitFactions: UNIT_FACTIONS,
  });

  fs.mkdirSync(PARSED_DIR, { recursive: true });
  writeJson('units.json', units);
  writeJson('detachments.json', detachments);
  writeJson('system.json', {
    ...system,
    bsdataCommit: source.commit,
    bsdataCommitDate: source.commitDate,
  });
  writeJson('catalogues.json', catalogueInfo);
  writeJson('rules.json', rules);

  console.log('\n=== Summary ===');
  console.log(`BSData ${source.repo}@${source.commit.slice(0, 7)} (${source.commitDate})`);
  console.log(`Game system: ${system.gameSystemName} rev ${system.revision}`);
  for (const [key, list] of Object.entries(units)) {
    const cat = catalogueInfo[key];
    console.log(`  ${key.padEnd(22)} ${String(list.length).padStart(4)} units   (${cat.catalogueName} rev ${cat.revision})`);
  }
  for (const chart of detachments.charts) {
    console.log(`Chart: ${chart.name} — ${chart.detachments.length} detachments`);
  }

  if (warnings.length > 0) {
    console.warn(`\nWarnings (${warnings.length}) — units needing manual review:`);
    for (const w of warnings) console.warn(`  ! ${w}`);
  } else {
    console.log('\nNo warnings — all units resolved cleanly.');
  }

  // ── Points sanity check ───────────────────────────────────────────────────
  console.log('\n=== Points Validation ===');
  let anomalies = 0;
  for (const [src, list] of Object.entries(units)) {
    for (const u of list) {
      if (u.points === 0) {
        console.log(`  ℹ️  ${u.name} (${src}): 0pts — free unit or parse miss`);
      } else if (u.points < 10) {
        console.warn(`  ⚠️  ${u.name} (${src}): ${u.points}pts — check manually`);
      } else if (u.points > 1000) {
        console.log(`  ℹ️  ${u.name} (${src}): ${u.points}pts — likely Primarch/LoW, confirm manually`);
      } else {
        continue;
      }
      anomalies++;
    }
  }
  console.log(anomalies === 0 ? '  All units passed (10–1000pts range).' : `  ${anomalies} unit(s) flagged above.`);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
