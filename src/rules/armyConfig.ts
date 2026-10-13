/**
 * armyConfig.ts
 * The army-level choices the builder makes (allegiance, Solar Auxilia cohort
 * doctrine), straight from BSData's army configuration entries — what they're
 * called and what choosing them puts in the roster for BSData conditions.
 */

import type { Allegiance } from '../types';
import { rulesData, type ArmyConfigEntry } from '../data/loader';
import { FACTION_BY_ID } from '../data/factions';

/** Army configuration entries available to an army (the game system's, then its catalogues'). */
export function armyConfigFor(faction: string): ArmyConfigEntry[] {
  const keys = ['game-system', ...(FACTION_BY_ID[faction]?.unitSources ?? [faction])];
  const seen = new Set<string>();
  return keys
    .flatMap((k) => rulesData.armyConfig[k] ?? [])
    .filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)));
}

const DOCTRINE_ENTRY = 'Cohort Doctrine';

/** The cohort doctrines an army can choose (Solar Auxilia), by BSData choice name. */
export function doctrineOptions(faction: string): string[] {
  return armyConfigFor(faction).find((e) => e.name === DOCTRINE_ENTRY)?.choices.map((c) => c.name) ?? [];
}

/** "Cohort Doctrine: Mechanised Pattern Cohort" → "Mechanised Pattern Cohort" */
export function doctrineLabel(choice: string): string {
  return choice.replace(/^Cohort Doctrine:\s*/, '');
}

/** Saves made before doctrines came from data stored a slug ("mechanised-pattern"). */
export function normalizeDoctrine(value: string | undefined): string {
  if (!value) return '';
  if (value.startsWith('Cohort Doctrine:')) return value;
  const words = value.replace(/-/g, ' ').toLowerCase();
  const all = Object.values(rulesData.armyConfig)
    .flat()
    .filter((e) => e.name === DOCTRINE_ENTRY)
    .flatMap((e) => e.choices.map((c) => c.name));
  return all.find((n) => doctrineLabel(n).toLowerCase().startsWith(words)) ?? '';
}

function choiceIds(faction: string, entryName: string, choiceName: string | undefined): string[] {
  if (!choiceName) return [];
  const entry = armyConfigFor(faction).find((e) => e.name === entryName || e.category === entryName);
  return entry?.choices.find((c) => c.name === choiceName)?.ids ?? [];
}

/** What the army's configuration puts in the roster: its allegiance and doctrine choices. */
export function configCounts(
  faction: string | undefined,
  opts: { allegiance?: Allegiance; cohortDoctrine?: string }
): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (ids: string[]) => ids.forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
  add(choiceIds(faction ?? '', 'Allegiance', opts.allegiance));
  if (faction) add(choiceIds(faction, DOCTRINE_ENTRY, opts.cohortDoctrine));
  return counts;
}
