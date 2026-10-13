/**
 * useSlotFlow.ts
 * The modal state machine for filling slots: unit picker → Prime benefit →
 * Logistical Benefit role → the detachments the unit unlocks, plus editing a
 * filled slot (each step returns to the slot editor instead of chaining).
 */

import { useMemo, useRef, useState } from 'react';
import type { FilledSlot, ModalState, PrimeBenefit, SlotDef, UnitEntry, DetachmentDef } from '../../types';
import { useRosterStore } from '../../store/rosterStore';
import { getBaseRole, stripPrimePrefix } from '../../data/loader';
import { unitContext } from '../../rules/context';
import { getPrimeOptions, isLogisticalBenefit, logisticalBenefitRoles, type PrimeOption } from '../../rules/primeBenefits';
import { unitsForSlot } from '../../rules/slots';
import { auxiliaryUnlocks } from '../../rules/detachmentLimits';
import { allegianceCounts, isAllegianceLocked } from '../../rules/availability';
import { cardSlots } from './slotLayout';
import type { RosterView } from './useRosterView';

export function useSlotFlow({ forces, allegiance, detachments, viewDetachments, counts }: RosterView) {
  const addDetachment = useRosterStore((s) => s.addDetachment);
  const fillSlot = useRosterStore((s) => s.fillSlot);
  const clearSlot = useRosterStore((s) => s.clearSlot);
  const setLogisticalRole = useRosterStore((s) => s.setLogisticalRole);
  const removeDetachment = useRosterStore((s) => s.removeDetachment);

  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  // Changes with every modal transition (each setModal makes a new state object)
  const modalSteps = useRef(0);
  const modalStep = useMemo(() => ++modalSteps.current, [modal]); // eslint-disable-line react-hooks/exhaustive-deps
  // Further Auxiliary selectors still owed to a slot (e.g. Officer of the Line's second)
  const pendingUnlocks = useRef<{ unlockedBy: string; remaining: number; total: number } | null>(null);
  // Set while editing a filled slot, so handlers return to the slot editor instead of chaining
  const isEditingSlot = useRef<{ detachmentId: string; slotKey: string } | null>(null);

  const placed = (detachmentId: string) => {
    const force = forces.find((f) => f.detachments.some((d) => d.id === detachmentId));
    return { force, det: force?.detachments.find((d) => d.id === detachmentId) };
  };

  /** The SlotDef shown for a slot key on a placed detachment. */
  function findSlotDef(detachmentId: string, slotKey: string): SlotDef | undefined {
    const det = viewDetachments.find((d) => d.id === detachmentId);
    return det ? cardSlots(det).find((s) => s.key === slotKey)?.slotDef : undefined;
  }

  /** Units that can fill a slot, less those the allegiance can't field. */
  function slotUnits(detachmentId: string, slot: SlotDef | undefined): UnitEntry[] {
    const { force, det } = placed(detachmentId);
    if (!force || !det || !slot) return [];
    const locked = allegianceCounts(forces, allegiance);
    return unitsForSlot(forces, force, det, slot, counts).filter((u) => !isAllegianceLocked(forces, force, det, u, locked));
  }

  /** Prime benefits a unit may take in a given slot, evaluated from BSData. */
  function primeOptionsFor(detachmentId: string, slotKey: string, unit: UnitEntry): PrimeOption[] {
    const { force, det } = placed(detachmentId);
    if (!force || !det) return [];
    return getPrimeOptions(unit, unitContext(forces, force, det, unit, findSlotDef(detachmentId, slotKey)?.categoryId, counts));
  }

  const close = () => setModal({ type: 'none' });

  /** After an edit, back to the slot editor with the updated slot. */
  function goBackToSlotEdit(detachmentId: string, slotKey: string, filled: FilledSlot) {
    isEditingSlot.current = null;
    const slotDef = findSlotDef(detachmentId, slotKey);
    setModal(slotDef ? { type: 'slotEdit', detachmentId, slotKey, slotDef, filled } : { type: 'none' });
  }

  /** Ends an edit step: back to the slot editor, or closed. */
  function finishEdit() {
    const editing = isEditingSlot.current;
    const filled = editing ? detachments.find((d) => d.id === editing.detachmentId)?.slots[editing.slotKey] : undefined;
    if (editing && filled) goBackToSlotEdit(editing.detachmentId, editing.slotKey, filled);
    else {
      isEditingSlot.current = null;
      close();
    }
  }

  function handleSlotClick(detachmentId: string, slotKey: string, slotDef: SlotDef) {
    const filled = detachments.find((d) => d.id === detachmentId)?.slots[slotKey];
    if (filled) setModal({ type: 'slotEdit', detachmentId, slotKey, slotDef, filled });
    else {
      setModal({
        type: 'unitPicker',
        detachmentId,
        slotKey,
        role: getBaseRole(stripPrimePrefix(slotDef.role)),
        isPrime: slotDef.prime,
      });
    }
  }

  function doClear(detachmentId: string, slotKey: string, affectedIds: string[]) {
    clearSlot(detachmentId, slotKey);
    for (const id of affectedIds) removeDetachment(id);
    close();
  }

  /** Clearing a slot removes what it unlocked; asks first if those detachments have units. */
  function handleSlotClear(detachmentId: string, slotKey: string) {
    const unlocked = detachments.filter((d) => d.unlockedBy === `${detachmentId}::${slotKey}`);
    const affectedIds = unlocked.map((d) => d.id);
    if (unlocked.some((d) => Object.values(d.slots).some(Boolean))) {
      setModal({ type: 'confirmClear', detachmentId, slotKey, affectedIds });
    } else {
      doClear(detachmentId, slotKey, affectedIds);
    }
  }

  /**
   * Opens the detachment selectors a newly placed unit earns: a High Command
   * unit picks an Apex or Auxiliary detachment; any other unit as many
   * Auxiliary detachments as it adds to the army's BSData allowance (1 per
   * Command unit, +1 for Officer of the Line (2)…).
   */
  function startUnlocks(detachmentId: string, slotKey: string, role: string) {
    const unlockedBy = `${detachmentId}::${slotKey}`;
    if (role === 'High Command') {
      setModal({ type: 'detachmentSelector', trigger: 'highCommand', unlockedBy });
      return;
    }
    const count = auxiliaryUnlocks(useRosterStore.getState().forces, detachmentId, slotKey);
    if (count === 0) {
      close();
      return;
    }
    pendingUnlocks.current = count > 1 ? { unlockedBy, remaining: count - 1, total: count } : null;
    setModal({
      type: 'detachmentSelector',
      trigger: 'command',
      unlockedBy,
      ...(count > 1 ? { title: `Choose Auxiliary Detachment (1 of ${count})` } : {}),
    });
  }

  /** Fills a slot, then opens what the unit unlocks (replacing what the slot unlocked before). */
  function fillAndUnlock(detachmentId: string, slotKey: string, role: string, unit: UnitEntry, benefit?: PrimeBenefit) {
    fillSlot(detachmentId, slotKey, unit, benefit);
    const unlockedBy = `${detachmentId}::${slotKey}`;
    for (const det of detachments.filter((d) => d.unlockedBy === unlockedBy)) removeDetachment(det.id);
    startUnlocks(detachmentId, slotKey, role);
  }

  function handleUnitConfirmed(unit: UnitEntry) {
    if (modal.type !== 'unitPicker') return;
    const { detachmentId, slotKey, role, isPrime } = modal;
    if (isEditingSlot.current) {
      // Editing: keep the Prime benefit, just change the unit
      const existingBenefit = detachments.find((d) => d.id === detachmentId)?.slots[slotKey]?.primeBenefit;
      fillSlot(detachmentId, slotKey, unit, existingBenefit);
      goBackToSlotEdit(detachmentId, slotKey, { unit, primeBenefit: existingBenefit });
      return;
    }
    if (isPrime) setModal({ type: 'primeBenefit', detachmentId, slotKey, role, unit });
    else fillAndUnlock(detachmentId, slotKey, role, unit);
  }

  function handlePrimeBenefitChosen(option: PrimeOption) {
    if (modal.type !== 'primeBenefit') return;
    const { detachmentId, slotKey, role, unit } = modal;
    const benefit = { id: option.id, name: option.name, description: option.description };
    if (isLogisticalBenefit(benefit)) {
      // A fresh role choice follows (BSData adds its slot once chosen)
      fillSlot(detachmentId, slotKey, unit, benefit);
      setLogisticalRole(detachmentId, slotKey, undefined);
      setModal({
        type: 'bonusSlotRoleSelector',
        detachmentId,
        slotKey,
        role,
        unit,
        // Only roles the army has units for
        roles: logisticalBenefitRoles(option).filter(
          (r) => slotUnits(detachmentId, { role: r, min: 0, max: 1, prime: false }).length > 0
        ),
      });
    } else if (isEditingSlot.current) {
      // Changing the benefit only — drops a Logistical Benefit role
      fillSlot(detachmentId, slotKey, unit, benefit);
      setLogisticalRole(detachmentId, slotKey, undefined);
      goBackToSlotEdit(detachmentId, slotKey, { unit, primeBenefit: benefit });
    } else {
      fillAndUnlock(detachmentId, slotKey, role, unit, benefit);
    }
  }

  function handleBonusSlotRoleSelected(bonusRole: string) {
    if (modal.type !== 'bonusSlotRoleSelector') return;
    const { detachmentId, slotKey, role } = modal;
    // BSData adds the slot for the chosen "LB - <role>"
    setLogisticalRole(detachmentId, slotKey, bonusRole);
    if (isEditingSlot.current) finishEdit();
    else startUnlocks(detachmentId, slotKey, role);
  }

  function handleDetachmentSelected(def: DetachmentDef) {
    if (modal.type !== 'detachmentSelector') return;
    const { unlockedBy } = modal;
    addDetachment(def, { unlockedBy });
    // More Auxiliary detachments owed to this slot (e.g. Officer of the Line)
    const pending = pendingUnlocks.current;
    if (pending?.unlockedBy === unlockedBy && pending.remaining > 0) {
      pending.remaining -= 1;
      if (pending.remaining === 0) pendingUnlocks.current = null;
      setModal({
        type: 'detachmentSelector',
        trigger: 'command',
        unlockedBy,
        title: `Choose Auxiliary Detachment (${pending.total - pending.remaining} of ${pending.total})`,
      });
      return;
    }
    finishEdit();
  }

  /** The slot editor's actions: change the unit, its benefit, or the detachments it unlocked. */
  function slotEditActions(detachmentId: string, slotKey: string, slotDef: SlotDef, filled: FilledSlot) {
    const role = getBaseRole(stripPrimePrefix(slotDef.role));
    const unlocks = role === 'High Command' || auxiliaryUnlocks(forces, detachmentId, slotKey) > 0;
    const unlockedBy = `${detachmentId}::${slotKey}`;
    const trigger = role === 'High Command' ? ('highCommand' as const) : ('command' as const);
    const edit = (next: ModalState) => {
      isEditingSlot.current = { detachmentId, slotKey };
      setModal(next);
    };
    const unlocked = detachments.filter((d) => d.unlockedBy === unlockedBy);
    return {
      linkedDetachments: unlocks
        ? unlocked.length > 0
          ? unlocked.map((det) => ({
              name: det.def.name,
              onChange: () => {
                removeDetachment(det.id);
                edit({ type: 'detachmentSelector', trigger, unlockedBy });
              },
            }))
          : [{ name: '', onChange: () => edit({ type: 'detachmentSelector', trigger, unlockedBy }) }]
        : undefined,
      onChangeUnit: () => edit({ type: 'unitPicker', detachmentId, slotKey, role, isPrime: slotDef.prime }),
      onChangeBenefit: () => edit({ type: 'primeBenefit', detachmentId, slotKey, role, unit: filled.unit }),
    };
  }

  return {
    modal,
    setModal,
    modalStep,
    close,
    findSlotDef,
    slotUnits,
    primeOptionsFor,
    handleSlotClick,
    handleSlotClear,
    doClear,
    handleUnitConfirmed,
    handlePrimeBenefitChosen,
    handleBonusSlotRoleSelected,
    handleDetachmentSelected,
    slotEditActions,
  };
}

export type SlotFlow = ReturnType<typeof useSlotFlow>;
