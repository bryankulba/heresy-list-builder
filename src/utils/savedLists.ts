import { v4 as uuidv4 } from 'uuid';
import type { RosterSnapshot, SavedList } from '../types';
import { ROSTER_SCHEMA_VERSION } from '../constants/schemaVersion';
import { migrateSnapshot } from '../store/rosterModel';

const SAVES_KEY = 'heresy-builder:saves';
export const SAVE_LIMIT = 10;

function readAll(): Record<string, SavedList> {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, SavedList>;
  } catch {
    return {};
  }
}

function writeAll(saves: Record<string, SavedList>): void {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  } catch (e) {
    console.error('[savedLists] Failed to write saves:', e);
  }
}

/** All saves, newest first, upgraded to the current roster shape. */
export function getAllSaves(): SavedList[] {
  const all = readAll();
  return Object.values(all)
    .map((raw): SavedList => ({
      id: raw.id,
      name: raw.name,
      savedAt: raw.savedAt,
      schemaVersion: ROSTER_SCHEMA_VERSION,
      ...migrateSnapshot(raw),
    }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function saveList(snapshot: RosterSnapshot, name: string): SavedList {
  const saves = readAll();
  const entry: SavedList = {
    id: uuidv4(),
    name,
    savedAt: Date.now(),
    schemaVersion: ROSTER_SCHEMA_VERSION,
    allegiance: snapshot.allegiance,
    pointsLimit: snapshot.pointsLimit,
    cohortDoctrine: snapshot.cohortDoctrine,
    armyChoices: snapshot.armyChoices ?? {},
    forces: snapshot.forces,
  };
  saves[entry.id] = entry;
  writeAll(saves);
  return entry;
}

export function deleteSave(id: string): void {
  const saves = readAll();
  delete saves[id];
  writeAll(saves);
}

export function canSaveMore(): boolean {
  return Object.keys(readAll()).length < SAVE_LIMIT;
}
