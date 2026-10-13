/**
 * canvasLayout.ts
 * Where each detachment card sits on the canvas (pure, from estimated card
 * heights): armies stacked vertically, each with its root detachment left
 * (Warlord below), Apex detachments in a 2-column grid to the right and the
 * rest (Auxiliary, Additional…) below them.
 */

import type { Force, PlacedDetachment } from '../../types';
import { factionLabel } from '../../data/factions';
import { estimateCardHeight } from './slotLayout';

export const CANVAS_W = 4000;
export const CANVAS_H = 3000;
export const CARD_W = 360;
const CARD_GAP = 24;
const CANVAS_ORIGIN_Y = 80;

// Primary card anchored top-left; everything else to its right
const PRIMARY_X = 24;
const RIGHT_X = PRIMARY_X + CARD_W + CARD_GAP * 2; // start of the right section
const RIGHT_COL_STRIDE = CARD_W + CARD_GAP; // distance between column starts
const RIGHT_COLS = 2;

const ROW_GAP = 24; // vertical gap between cards in the same column/grid
const SECTION_GAP = 64; // vertical gap between the apex group and the aux group
const FORCE_GAP = 96; // vertical gap between one army's cards and the next
const FORCE_LABEL_H = 32; // space reserved above an allied / Lord of War army for its label

export interface CardPosition {
  x: number;
  y: number;
}

export interface ForceLabel {
  forceId: string;
  text: string;
  x: number;
  y: number;
}

/** Card positions for one army, and how far down it reaches. */
export function layoutForce(force: Force, originY: number): { positions: Map<string, CardPosition>; bottom: number } {
  const positions = new Map<string, CardPosition>();
  const [root, ...rest] = force.detachments;
  const warlord = rest.find((d) => d.def.name === 'Warlord Detachment');
  const others = rest.filter((d) => d !== warlord);
  const apex = others.filter((d) => d.def.type === 'apex');
  const auxiliaries = others.filter((d) => d.def.type !== 'apex');

  let bottom = originY;

  // Left column: root, then Warlord
  let leftY = originY;
  for (const det of [root, warlord]) {
    if (!det) continue;
    positions.set(det.id, { x: PRIMARY_X, y: leftY });
    leftY += estimateCardHeight(det) + ROW_GAP;
    bottom = Math.max(bottom, leftY - ROW_GAP);
  }

  // Right side: 2-column grids, each row as tall as its tallest card
  const placeGrid = (dets: PlacedDetachment[], startY: number): number => {
    let y = startY;
    for (let i = 0; i < dets.length; i += RIGHT_COLS) {
      const row = dets.slice(i, i + RIGHT_COLS);
      row.forEach((det, col) => positions.set(det.id, { x: RIGHT_X + col * RIGHT_COL_STRIDE, y }));
      y += Math.max(...row.map(estimateCardHeight)) + ROW_GAP;
    }
    return dets.length > 0 ? y - ROW_GAP : startY;
  };
  const apexBottom = placeGrid(apex, originY);
  const auxBottom = placeGrid(auxiliaries, apex.length > 0 ? apexBottom + SECTION_GAP : originY);

  return { positions, bottom: Math.max(bottom, apexBottom, auxBottom) };
}

/** Card positions for every army, stacked vertically; plus a label above each allied / Lord of War army. */
export function computeCardPositions(forces: Force[]): { positions: Map<string, CardPosition>; labels: ForceLabel[] } {
  const positions = new Map<string, CardPosition>();
  const labels: ForceLabel[] = [];
  let y = CANVAS_ORIGIN_Y;
  for (const force of forces) {
    if (force.kind !== 'primary') {
      const text = force.kind === 'allied' ? `Allies — ${factionLabel(force.faction)}` : 'Lord of War';
      labels.push({ forceId: force.id, text, x: PRIMARY_X, y });
      y += FORCE_LABEL_H;
    }
    const laid = layoutForce(force, y);
    laid.positions.forEach((pos, id) => positions.set(id, pos));
    y = laid.bottom + FORCE_GAP;
  }
  return { positions, labels };
}

/** "#1", "#2"… for detachments that appear more than once (by name); undefined for unique ones. */
export function computeInstanceNumbers(dets: PlacedDetachment[]): Map<string, number | undefined> {
  const countByName = new Map<string, number>();
  for (const d of dets) countByName.set(d.def.name, (countByName.get(d.def.name) ?? 0) + 1);

  const result = new Map<string, number | undefined>();
  const seenByName = new Map<string, number>();
  for (const d of dets) {
    if ((countByName.get(d.def.name) ?? 0) > 1) {
      const idx = (seenByName.get(d.def.name) ?? 0) + 1;
      seenByName.set(d.def.name, idx);
      result.set(d.id, idx);
    } else {
      result.set(d.id, undefined);
    }
  }
  return result;
}
