import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Allegiance, AppPhase, BonusSlot, DetachmentDef, FilledSlot, PlacedDetachment, PrimeBenefit, UnitEntry } from '../types';
import { detachmentsData } from '../data/loader';

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export function computeTotalPoints(detachments: PlacedDetachment[]): number {
  return detachments.reduce((total, det) => {
    const slotPts = Object.values(det.slots).reduce((sum, fs) => {
      return sum + (fs ? fs.unit.points + (fs.extraPoints ?? 0) : 0);
    }, 0);
    const bonusPts = (det.bonusSlots ?? []).reduce((sum, bs) => {
      return sum + (bs.unit ? bs.unit.points + (bs.extraPoints ?? 0) : 0);
    }, 0);
    return total + slotPts + bonusPts;
  }, 0);
}

function makeEmptyPlacedDetachment(def: DetachmentDef, unlockedBy?: string): PlacedDetachment {
  return { id: uuidv4(), def, slots: {}, unlockedBy };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface RosterStore {
  phase: AppPhase;
  faction: string;
  allegiance: Allegiance;
  pointsLimit: number;
  detachments: PlacedDetachment[];

  startBuild: (faction: string, allegiance: Allegiance, pointsLimit: number) => void;
  addDetachment: (def: DetachmentDef, unlockedBy?: string) => void;
  fillSlot: (detachmentId: string, slotKey: string, unit: UnitEntry, primeBenefit?: PrimeBenefit) => void;
  updateSlotAnnotations: (detachmentId: string, slotKey: string, notes: string, extraPoints: number) => void;
  clearSlot: (detachmentId: string, slotKey: string) => void;
  addBonusSlot: (detachmentId: string, sourceSlotKey: string, role: string) => void;
  fillBonusSlot: (detachmentId: string, bonusSlotId: string, unit: UnitEntry) => void;
  clearBonusSlot: (detachmentId: string, bonusSlotId: string) => void;
  removeDetachment: (id: string) => void;
  clearBonusSlotsForSlot: (detachmentId: string, slotKey: string) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  phase: 'start' as AppPhase,
  faction: 'death-guard',
  allegiance: 'Traitor' as Allegiance,
  pointsLimit: 3000,
  detachments: [] as PlacedDetachment[],
};

export const useRosterStore = create<RosterStore>((set, get) => ({
  ...INITIAL_STATE,

  startBuild(faction, allegiance, pointsLimit) {
    const primaryDef = detachmentsData.core.find(
      (d) => d.name === 'Crusade Primary Detachment'
    );
    if (!primaryDef) throw new Error('Crusade Primary Detachment not found in data');

    set({
      phase: 'canvas',
      faction,
      allegiance,
      pointsLimit,
      detachments: [makeEmptyPlacedDetachment(primaryDef)],
    });
  },

  addDetachment(def, unlockedBy) {
    set((s) => ({
      detachments: [...s.detachments, makeEmptyPlacedDetachment(def, unlockedBy)],
    }));
  },

  fillSlot(detachmentId, slotKey, unit, primeBenefit) {
    set((s) => ({
      detachments: s.detachments.map((det) => {
        if (det.id !== detachmentId) return det;
        const existing = det.slots[slotKey];
        const filled: FilledSlot = {
          unit,
          primeBenefit,
          notes: existing?.notes,
          extraPoints: existing?.extraPoints,
        };
        return { ...det, slots: { ...det.slots, [slotKey]: filled } };
      }),
    }));
  },

  updateSlotAnnotations(detachmentId, slotKey, notes, extraPoints) {
    set((s) => ({
      detachments: s.detachments.map((det) => {
        if (det.id !== detachmentId) return det;
        const existing = det.slots[slotKey];
        if (!existing) return det;
        return { ...det, slots: { ...det.slots, [slotKey]: { ...existing, notes, extraPoints } } };
      }),
    }));
  },

  clearSlot(detachmentId, slotKey) {
    set((s) => ({
      detachments: s.detachments.map((det) => {
        if (det.id !== detachmentId) return det;
        return {
          ...det,
          slots: { ...det.slots, [slotKey]: null },
          // cascade-remove any bonus slots that were created by this prime slot
          bonusSlots: (det.bonusSlots ?? []).filter((b) => b.sourceSlotKey !== slotKey),
        };
      }),
    }));
  },

  addBonusSlot(detachmentId, sourceSlotKey, role) {
    const newSlot: BonusSlot = { id: uuidv4(), sourceSlotKey, role, unit: null };
    set((s) => ({
      detachments: s.detachments.map((det) => {
        if (det.id !== detachmentId) return det;
        return { ...det, bonusSlots: [...(det.bonusSlots ?? []), newSlot] };
      }),
    }));
  },

  fillBonusSlot(detachmentId, bonusSlotId, unit) {
    set((s) => ({
      detachments: s.detachments.map((det) => {
        if (det.id !== detachmentId) return det;
        return {
          ...det,
          bonusSlots: (det.bonusSlots ?? []).map((b) =>
            b.id === bonusSlotId ? { ...b, unit } : b
          ),
        };
      }),
    }));
  },

  clearBonusSlot(detachmentId, bonusSlotId) {
    set((s) => ({
      detachments: s.detachments.map((det) => {
        if (det.id !== detachmentId) return det;
        return {
          ...det,
          bonusSlots: (det.bonusSlots ?? []).map((b) =>
            b.id === bonusSlotId ? { ...b, unit: null } : b
          ),
        };
      }),
    }));
  },

  clearBonusSlotsForSlot(detachmentId, slotKey) {
    set((s) => ({
      detachments: s.detachments.map((det) => {
        if (det.id !== detachmentId) return det;
        return {
          ...det,
          bonusSlots: (det.bonusSlots ?? []).filter((b) => b.sourceSlotKey !== slotKey),
        };
      }),
    }));
  },

  removeDetachment(id) {
    // Cascade: also remove any detachment unlocked by a slot on the removed detachment
    const allDets = get().detachments;
    const idsToRemove = new Set<string>();

    function collectCascade(removedId: string) {
      idsToRemove.add(removedId);
      for (const det of allDets) {
        if (det.unlockedBy?.startsWith(`${removedId}::`) && !idsToRemove.has(det.id)) {
          collectCascade(det.id);
        }
      }
    }

    collectCascade(id);
    set((s) => ({
      detachments: s.detachments.filter((d) => !idsToRemove.has(d.id)),
    }));
  },

  reset() {
    set(INITIAL_STATE);
  },
}));
