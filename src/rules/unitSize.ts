/**
 * unitSize.ts
 * A unit's size: how many of each model type it has (BSData min / max per
 * model type, the minimum unless changed in the slot) and the points that
 * come with it. Pure — used by the roster model, rule counts and the export.
 */

import type { FilledSlot, ModelEntry } from '../types';

/** Identifies a model type of a unit in `FilledSlot.modelCounts`. */
export function modelKey(m: ModelEntry): string {
  return m.path ?? m.entryId ?? m.name;
}

/** Whether the unit's size can change: some model type has a range (Legionaries 9–19). */
export function isSizeAdjustable(m: ModelEntry): boolean {
  return m.max > m.min;
}

/** How many of a model type the slot's unit has (its minimum unless changed), within BSData's range. */
export function modelCount(fs: Pick<FilledSlot, 'modelCounts'>, m: ModelEntry): number {
  const n = fs.modelCounts?.[modelKey(m)];
  return n === undefined ? m.min : Math.max(m.min, Math.min(Math.max(m.min, m.max), n));
}

/** The unit's points at its size: BSData points (at minimum size) plus each extra model's cost. */
export function unitPoints(fs: FilledSlot): number {
  return fs.unit.points + fs.unit.models.reduce((sum, m) => sum + (modelCount(fs, m) - m.min) * m.cost, 0);
}

/** Models in the unit at its size (top-level model types). */
export function unitModelTotal(fs: FilledSlot): number {
  return fs.unit.models.reduce((n, m) => n + modelCount(fs, m), 0);
}

/** A slot's points: the unit at its size plus any extra points noted. */
export function slotPoints(fs: FilledSlot | null | undefined): number {
  return fs ? unitPoints(fs) + (fs.extraPoints ?? 0) : 0;
}
