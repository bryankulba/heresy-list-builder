/**
 * slotLayout.ts
 * Pure helpers turning a detachment's slot definitions into the slot positions
 * a card shows (shared by the canvas, list export and .ros export).
 */

import type { PlacedDetachment, SlotDef } from '../../types';
import { getBaseRole, stripPrimePrefix } from '../../data/loader';

export interface ExpandedSlot {
  key: string;
  slotDef: SlotDef;
}

export function expandSlots(def: PlacedDetachment['def']): ExpandedSlot[] {
  // Drop qualifier slots (e.g. "Command - Centurions Only") only when a parent
  // slot with the base role exists in the same detachment. Qualifier slots that
  // ARE the primary slot (e.g. Solar Auxilia "Troops - Lasrifle Section Units only")
  // are kept because no parent "Troops" slot exists alongside them.
  const relevant = def.slots.filter(s => {
    if (!s.role.includes(' - ')) return true;
    const baseRole = s.role.split(' - ')[0];
    return !def.slots.some(other => other.role === baseRole);
  });

  const primeSlots = relevant.filter(s => s.prime);
  const regularSlots = relevant.filter(s => !s.prime);

  const result: ExpandedSlot[] = [];

  // Iterate regular slots in BSData order to preserve role group ordering.
  // Within each role: prime slot(s) first, then remaining regular slots.
  for (const regular of regularSlots) {
    // For qualifier slots (e.g. "Troops - Lasrifle Section Units only"), match
    // prime slots against the base role ("Troops") so "Prime Troops" pairs correctly.
    const regularBase = regular.role.includes(' - ') ? regular.role.split(' - ')[0] : regular.role;
    const prime = primeSlots.find(p => p.role.replace(/^Prime /, '') === regularBase);
    const primeCount = prime?.max ?? 0;

    if (prime) {
      for (let i = 0; i < prime.max; i++) {
        result.push({ key: `${prime.role}-${i}`, slotDef: prime });
      }
    }

    const remaining = regular.max - primeCount;
    for (let i = 0; i < remaining; i++) {
      result.push({ key: `${regular.role}-${primeCount + i}`, slotDef: regular });
    }
  }

  return result;
}

// Card geometry used to estimate rendered height for canvas layout (calibrated
// against the rendered card; errs slightly large so cards never overlap).
const CARD_CHROME_H = 64;     // padding + header
const ROLE_HEADING_H = 30;    // role label + gap
const SLOT_ROW_H = 74;        // one row of slots incl. gap
const SLOTS_PER_ROW = 6;

/** Estimated rendered height of a detachment card, from its slots. */
export function estimateCardHeight(detachment: PlacedDetachment): number {
  const groups = groupByRole(cardSlots(detachment));
  const bonus = detachment.bonusSlots?.length ?? 0;
  const groupHeights = groups.map((g) => ROLE_HEADING_H + Math.ceil(g.slots.length / SLOTS_PER_ROW) * SLOT_ROW_H);
  if (bonus > 0) groupHeights.push(ROLE_HEADING_H + Math.ceil(bonus / SLOTS_PER_ROW) * SLOT_ROW_H);
  return CARD_CHROME_H + groupHeights.reduce((a, b) => a + b, 0);
}

/** "Troops-2" ⇄ "Prime Troops-2": the same position, prime or not. */
function positionAlias(key: string): string {
  return key.startsWith('Prime ') ? key.slice('Prime '.length) : `Prime ${key}`;
}

/**
 * The slots a card shows, with the key each unit is stored under:
 *  - expanded slots; a position whose prime-ness changed (a rule turned Troops
 *    Prime, or stopped doing so) shows the unit stored under the other key
 *  - any other filled slot outside the expansion (e.g. a slot count dropped),
 *    so a placed unit never silently disappears
 */
export function cardSlots(detachment: PlacedDetachment): ExpandedSlot[] {
  const expanded = expandSlots(detachment.def);
  const keys = new Set(expanded.map((e) => e.key));
  const used = new Set<string>();
  const shown = expanded.map((e): ExpandedSlot => {
    if (detachment.slots[e.key]) {
      used.add(e.key);
      return e;
    }
    const alias = positionAlias(e.key);
    if (detachment.slots[alias] && !keys.has(alias)) {
      used.add(alias);
      return { key: alias, slotDef: e.slotDef };
    }
    return e;
  });
  const overflow = Object.entries(detachment.slots)
    .filter(([key, fs]) => fs && !used.has(key) && !keys.has(key))
    .map(([key]): ExpandedSlot => {
      const role = key.slice(0, key.lastIndexOf('-'));
      const slotDef = detachment.def.slots.find((s) => s.role === role) ?? {
        role,
        min: 0,
        max: 0,
        prime: role.startsWith('Prime '),
      };
      return { key, slotDef };
    });
  return [...shown, ...overflow];
}

export interface SlotGroup {
  displayRole: string;
  slots: ExpandedSlot[];
}

export function groupByRole(expanded: ExpandedSlot[]): SlotGroup[] {
  const groups: SlotGroup[] = [];
  const seen = new Map<string, SlotGroup>();
  for (const es of expanded) {
    const displayRole = getBaseRole(stripPrimePrefix(es.slotDef.role));
    if (!seen.has(displayRole)) {
      const group: SlotGroup = { displayRole, slots: [] };
      groups.push(group);
      seen.set(displayRole, group);
    }
    seen.get(displayRole)!.slots.push(es);
  }
  return groups;
}

