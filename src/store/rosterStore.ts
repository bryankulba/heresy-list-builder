import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Allegiance,
  AppPhase,
  BonusSlot,
  DetachmentDef,
  FilledSlot,
  Force,
  PrimeBenefit,
  RosterSnapshot,
  UnitEntry,
} from '../types';
import {
  addDetachment,
  createForce,
  migrateSnapshot,
  primaryForce,
  refreshUnits,
  removeDetachmentCascade,
  updateDetachment,
} from './rosterModel';

export { computeTotalPoints } from './rosterModel';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface RosterStore {
  phase: AppPhase;
  allegiance: Allegiance;
  pointsLimit: number;
  cohortDoctrine: string;
  /** Army-wide picks for per-unit choices (sub-faction): group id → option id */
  armyChoices: Record<string, string>;
  /** The primary army first, then any allied forces */
  forces: Force[];

  startBuild: (
    faction: string,
    allegiance: Allegiance,
    pointsLimit: number,
    cohortDoctrine?: string,
    armyChoices?: Record<string, string>
  ) => void;
  setArmyChoice: (groupId: string, optionId: string) => void;
  loadSave: (saved: RosterSnapshot) => void;
  addDetachment: (def: DetachmentDef, opts?: { unlockedBy?: string; forceId?: string }) => void;
  addAlliedForce: (faction: string) => void;
  removeForce: (forceId: string) => void;
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
  allegiance: 'Traitor' as Allegiance,
  pointsLimit: 3000,
  cohortDoctrine: '',
  armyChoices: {} as Record<string, string>,
  forces: [] as Force[],
};

/** Faction of the primary army. */
export function selectPrimaryFaction(s: { forces: Force[] }): string {
  return primaryForce(s.forces)?.faction ?? '';
}

export const useRosterStore = create<RosterStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      startBuild(faction, allegiance, pointsLimit, cohortDoctrine = '', armyChoices = {}) {
        set({
          phase: 'canvas',
          allegiance,
          pointsLimit,
          cohortDoctrine,
          armyChoices,
          forces: [createForce(faction, 'primary')],
        });
      },

      loadSave(saved) {
        const snapshot = migrateSnapshot(saved);
        set({ phase: 'canvas', ...snapshot, armyChoices: snapshot.armyChoices ?? {}, forces: refreshUnits(snapshot.forces) });
      },

      setArmyChoice(groupId, optionId) {
        set((s) => ({ armyChoices: { ...s.armyChoices, [groupId]: optionId } }));
      },

      addDetachment(def, opts) {
        set((s) => ({ forces: addDetachment(s.forces, def, opts) }));
      },

      addAlliedForce(faction) {
        set((s) => ({ forces: [...s.forces, createForce(faction, 'allied')] }));
      },

      removeForce(forceId) {
        set((s) => ({ forces: s.forces.filter((f) => f.id !== forceId || f.kind === 'primary') }));
      },

      fillSlot(detachmentId, slotKey, unit, primeBenefit) {
        set((s) => ({
          forces: updateDetachment(s.forces, detachmentId, (det) => {
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
          forces: updateDetachment(s.forces, detachmentId, (det) => {
            const existing = det.slots[slotKey];
            if (!existing) return det;
            return { ...det, slots: { ...det.slots, [slotKey]: { ...existing, notes, extraPoints } } };
          }),
        }));
      },

      clearSlot(detachmentId, slotKey) {
        set((s) => ({
          forces: updateDetachment(s.forces, detachmentId, (det) => ({
            ...det,
            slots: { ...det.slots, [slotKey]: null },
            // cascade-remove any bonus slots that were created by this prime slot
            bonusSlots: (det.bonusSlots ?? []).filter((b) => b.sourceSlotKey !== slotKey),
          })),
        }));
      },

      addBonusSlot(detachmentId, sourceSlotKey, role) {
        const newSlot: BonusSlot = { id: uuidv4(), sourceSlotKey, role, unit: null };
        set((s) => ({
          forces: updateDetachment(s.forces, detachmentId, (det) => ({
            ...det,
            bonusSlots: [...(det.bonusSlots ?? []), newSlot],
          })),
        }));
      },

      fillBonusSlot(detachmentId, bonusSlotId, unit) {
        set((s) => ({
          forces: updateDetachment(s.forces, detachmentId, (det) => ({
            ...det,
            bonusSlots: (det.bonusSlots ?? []).map((b) => (b.id === bonusSlotId ? { ...b, unit } : b)),
          })),
        }));
      },

      clearBonusSlot(detachmentId, bonusSlotId) {
        set((s) => ({
          forces: updateDetachment(s.forces, detachmentId, (det) => ({
            ...det,
            bonusSlots: (det.bonusSlots ?? []).map((b) => (b.id === bonusSlotId ? { ...b, unit: null } : b)),
          })),
        }));
      },

      clearBonusSlotsForSlot(detachmentId, slotKey) {
        set((s) => ({
          forces: updateDetachment(s.forces, detachmentId, (det) => ({
            ...det,
            bonusSlots: (det.bonusSlots ?? []).filter((b) => b.sourceSlotKey !== slotKey),
          })),
        }));
      },

      removeDetachment(id) {
        set((s) => ({ forces: removeDetachmentCascade(s.forces, id) }));
      },

      reset() {
        set(INITIAL_STATE);
      },
    }),
    {
      name: 'heresy-builder:session',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        phase: state.phase,
        allegiance: state.allegiance,
        pointsLimit: state.pointsLimit,
        cohortDoctrine: state.cohortDoctrine,
        armyChoices: state.armyChoices,
        forces: state.forces,
      }),
      // v1 persisted { faction, detachments }; v2 persists { forces }
      migrate: (persisted, version) => {
        const p = persisted as { phase?: AppPhase };
        if (version >= 2) return persisted as RosterStore;
        return { phase: p.phase ?? 'start', ...migrateSnapshot(persisted) } as unknown as RosterStore;
      },
      // Refresh unit snapshots from the current data on every load
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RosterStore>;
        const forces = refreshUnits(p.forces ?? []);
        return { ...current, ...p, forces, phase: forces.length > 0 ? p.phase ?? 'start' : 'start' };
      },
    }
  )
);
