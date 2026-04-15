import { v4 as uuidv4 } from 'uuid';
import { SavedList, PlacedDetachment, Allegiance } from '../types';
import { ROSTER_SCHEMA_VERSION } from '../constants/schemaVersion';

const SAVES_KEY = 'heresy-builder:saves';
export const SAVE_LIMIT = 10;

type RosterSnapshot = {
  faction: string;
  allegiance: Allegiance;
  pointsLimit: number;
  cohortDoctrine: string;
  detachments: PlacedDetachment[];
};

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

export function getAllSaves(): SavedList[] {
  const all = readAll();
  return Object.values(all).sort((a, b) => b.savedAt - a.savedAt);
}

export function saveList(snapshot: RosterSnapshot, name: string): SavedList {
  const saves = readAll();
  const entry: SavedList = {
    id: uuidv4(),
    name,
    savedAt: Date.now(),
    schemaVersion: ROSTER_SCHEMA_VERSION,
    ...snapshot,
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
