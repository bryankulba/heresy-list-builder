import { loadFactionUnits } from '../data/loader';
import { normalizeDoctrine } from '../rules/armyConfig';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Allegiance,
  AppPhase,
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
  /** Army settings (Rite of War, Household Paradigms…): entry name → choice name */
  configChoices: Record<string, string>;
  /** The primary army first, then any allied forces */
  forces: Force[];

  startBuild: (
    faction: string,
    allegiance: Allegiance,
    pointsLimit: number,
    cohortDoctrine?: string,
    armyChoices?: Record<string, string>,
    configChoices?: Record<string, string>
  ) => void;
  setArmyChoice: (groupId: string, optionId: string) => void;
  setConfigChoice: (entry: string, choice: string) => void;
  loadSave: (saved: RosterSnapshot) => void;
  addDetachment: (def: DetachmentDef, opts?: { unlockedBy?: string; forceId?: string }) => void;
  addAlliedForce: (faction: string) => void;
  /** Loads the units of the session's armies (after a reload) and refreshes the stored ones */
  ensureUnitsLoaded: () => Promise<void>;
  /** Adds a Lord of War Detachment for the primary army (right after it) */
  addLordOfWar: () => void;
  removeForce: (forceId: string) => void;
  fillSlot: (detachmentId: string, slotKey: string, unit: UnitEntry, primeBenefit?: PrimeBenefit) => void;
  updateSlotAnnotations: (detachmentId: string, slotKey: string, notes: string, extraPoints: number) => void;
  clearSlot: (detachmentId: string, slotKey: string) => void;
  /** Logistical Benefit: the role of the extra slot (BSData adds it); undefined clears it */
  setLogisticalRole: (detachmentId: string, slotKey: string, role: string | undefined) => void;
  removeDetachment: (id: string) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  phase: 'start' as AppPhase,
  allegiance: 'Traitor' as Allegiance,
  pointsLimit: 3000,
  cohortDoctrine: '',
  armyChoices: {} as Record<string, string>,
  configChoices: {} as Record<string, string>,
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

      async startBuild(faction, allegiance, pointsLimit, cohortDoctrine = '', armyChoices = {}, configChoices = {}) {
        await loadFactionUnits(faction);
        set({
          phase: 'canvas',
          allegiance,
          pointsLimit,
          cohortDoctrine,
          armyChoices,
          configChoices,
          forces: [createForce(faction, 'primary')],
        });
      },

      async loadSave(saved) {
        const snapshot = migrateSnapshot(saved);
        await loadFactionUnits(...snapshot.forces.map((f) => f.faction));
        set({
          phase: 'canvas',
          ...snapshot,
          armyChoices: snapshot.armyChoices ?? {},
          configChoices: snapshot.configChoices ?? {},
          forces: refreshUnits(snapshot.forces),
        });
      },

      setArmyChoice(groupId, optionId) {
        set((s) => ({ armyChoices: { ...s.armyChoices, [groupId]: optionId } }));
      },

      setConfigChoice(entry, choice) {
        set((s) => {
          const { [entry]: _old, ...rest } = s.configChoices;
          return { configChoices: choice ? { ...rest, [entry]: choice } : rest };
        });
      },

      addDetachment(def, opts) {
        set((s) => ({ forces: addDetachment(s.forces, def, opts) }));
      },

      addLordOfWar() {
        set((s) => {
          const primary = s.forces.find((f) => f.kind === 'primary');
          if (!primary || s.forces.some((f) => f.kind === 'lordOfWar')) return {};
          const [first, ...rest] = s.forces;
          return { forces: [first, createForce(primary.faction, 'lordOfWar'), ...rest] };
        });
      },

      async addAlliedForce(faction) {
        await loadFactionUnits(faction);
        set((s) => ({ forces: [...s.forces, createForce(faction, 'allied')] }));
      },

      async ensureUnitsLoaded() {
        const { forces } = useRosterStore.getState();
        await loadFactionUnits(...forces.map((f) => f.faction));
        // Saved units were kept as-is until their army's data arrived; refresh them now
        set((s) => ({ forces: refreshUnits(s.forces) }));
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
              // Keep the Logistical Benefit role while the benefit stays the same
              ...(existing?.lbRole && primeBenefit && existing.primeBenefit?.id === primeBenefit.id
                ? { lbRole: existing.lbRole }
                : {}),
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
          })),
        }));
      },

      setLogisticalRole(detachmentId, slotKey, role) {
        set((s) => ({
          forces: updateDetachment(s.forces, detachmentId, (det) => {
            const existing = det.slots[slotKey];
            if (!existing) return det;
            const { lbRole: _old, ...rest } = existing;
            return { ...det, slots: { ...det.slots, [slotKey]: role ? { ...rest, lbRole: role } : rest } };
          }),
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
        configChoices: state.configChoices,
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
        return {
          ...current,
          ...p,
          forces,
          cohortDoctrine: normalizeDoctrine(p.cohortDoctrine),
          phase: forces.length > 0 ? p.phase ?? 'start' : 'start',
        };
      },
    }
  )
);
