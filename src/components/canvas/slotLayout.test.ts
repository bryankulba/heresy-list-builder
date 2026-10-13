import { describe, test, expect } from 'vitest';
import { cardSlots } from './slotLayout';
import type { PlacedDetachment, SlotDef, UnitEntry } from '../../types';

const slot = (role: string, max: number): SlotDef => ({ role, min: 0, max, prime: role.startsWith('Prime ') });
const unit = { name: 'Tactical Squad' } as UnitEntry;

function det(primeMax: number, slots: PlacedDetachment['slots']): PlacedDetachment {
  return { id: 'd', def: { name: 'D', type: 'core', slots: [slot('Troops', 4), slot('Prime Troops', primeMax)] }, slots };
}

describe('cardSlots', () => {
  test('lays out prime positions first, then regular', () => {
    expect(cardSlots(det(1, {})).map((s) => s.key)).toEqual(['Prime Troops-0', 'Troops-1', 'Troops-2', 'Troops-3']);
  });

  test('a position that became Prime shows the unit stored under its regular key', () => {
    const shown = cardSlots(det(4, { 'Prime Troops-0': { unit }, 'Troops-1': { unit }, 'Troops-3': { unit } }));
    expect(shown.map((s) => [s.key, s.slotDef.role])).toEqual([
      ['Prime Troops-0', 'Prime Troops'],
      ['Troops-1', 'Prime Troops'],
      ['Prime Troops-2', 'Prime Troops'],
      ['Troops-3', 'Prime Troops'],
    ]);
  });

  test('a position that stopped being Prime shows its unit as regular', () => {
    const shown = cardSlots(det(1, { 'Prime Troops-0': { unit }, 'Prime Troops-2': { unit } }));
    expect(shown.map((s) => [s.key, s.slotDef.role])).toEqual([
      ['Prime Troops-0', 'Prime Troops'],
      ['Troops-1', 'Troops'],
      ['Prime Troops-2', 'Troops'],
      ['Troops-3', 'Troops'],
    ]);
  });

  test('units beyond the slot count stay visible as overflow', () => {
    const shown = cardSlots(det(1, { 'Troops-7': { unit } }));
    expect(shown.map((s) => s.key)).toContain('Troops-7');
  });
});
