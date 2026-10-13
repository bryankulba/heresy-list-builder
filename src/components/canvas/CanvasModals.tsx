/**
 * CanvasModals.tsx
 * Renders the modal the slot flow (or a header action) has open. Keyed per
 * step so a chained modal (e.g. the second Officer of the Line selector) opens
 * fresh instead of keeping the previous one's scroll position.
 */

import React from 'react';
import type { DetachmentDef, Force } from '../../types';
import { useRosterStore } from '../../store/rosterStore';
import { factionOfDetachment } from '../../store/rosterModel';
import { getDetachmentDisplayName } from '../../data/loader';
import { factionLabel, type FactionDef } from '../../data/factions';
import { detachmentAvailability } from '../../rules/options';
import SlotEditModal from '../modals/SlotEditModal';
import UnitPickerModal from '../modals/UnitPickerModal';
import PrimeBenefitModal from '../modals/PrimeBenefitModal';
import BonusSlotRoleSelectorModal from '../modals/BonusSlotRoleSelectorModal';
import DetachmentSelectorModal from '../modals/DetachmentSelectorModal';
import AllySelectorModal from '../modals/AllySelectorModal';
import ConfirmModal from '../modals/ConfirmModal';
import ExportModal from '../modals/ExportModal';
import SavedListsModal from '../modals/SavedListsModal';
import type { RosterView } from './useRosterView';
import type { SlotFlow } from './useSlotFlow';

interface CanvasModalsProps {
  roster: RosterView;
  flow: SlotFlow;
  primary: Force | undefined;
  additionalDetachments: DetachmentDef[];
  allyFactions: FactionDef[];
  totalPoints: number;
}

export default function CanvasModals({ roster, flow, primary, additionalDetachments, allyFactions, totalPoints }: CanvasModalsProps) {
  const { forces, detachments, counts, allegiance, pointsLimit } = roster;
  const { modal, close } = flow;
  const addDetachment = useRosterStore((s) => s.addDetachment);
  const addAlliedForce = useRosterStore((s) => s.addAlliedForce);
  const removeForce = useRosterStore((s) => s.removeForce);
  const removeDetachment = useRosterStore((s) => s.removeDetachment);
  const updateSlotAnnotations = useRosterStore((s) => s.updateSlotAnnotations);
  const reset = useRosterStore((s) => s.reset);

  /** Faction of the army a detachment (or "detId::slotKey" reference) belongs to. */
  const factionFor = (ref: string) => factionOfDetachment(forces, ref);
  const forceOf = (ref: string) => forces.find((f) => f.detachments.some((d) => d.id === ref.split('::')[0]));

  return (
    <React.Fragment key={flow.modalStep}>
      {modal.type === 'slotEdit' && (
        <SlotEditModal
          slotDef={modal.slotDef}
          filled={modal.filled}
          {...flow.slotEditActions(modal.detachmentId, modal.slotKey, modal.slotDef, modal.filled)}
          onAnnotationsChange={(notes, extraPoints) =>
            updateSlotAnnotations(modal.detachmentId, modal.slotKey, notes, extraPoints)
          }
          onRemove={() => flow.handleSlotClear(modal.detachmentId, modal.slotKey)}
          onClose={close}
        />
      )}

      {modal.type === 'unitPicker' && (
        <UnitPickerModal
          role={modal.role}
          units={flow.slotUnits(modal.detachmentId, flow.findSlotDef(modal.detachmentId, modal.slotKey))}
          faction={factionFor(modal.detachmentId)}
          onConfirm={flow.handleUnitConfirmed}
          onClose={close}
        />
      )}

      {modal.type === 'primeBenefit' && (
        <PrimeBenefitModal
          options={flow.primeOptionsFor(modal.detachmentId, modal.slotKey, modal.unit)}
          onConfirm={flow.handlePrimeBenefitChosen}
          onClose={close}
        />
      )}

      {modal.type === 'bonusSlotRoleSelector' && (
        <BonusSlotRoleSelectorModal roles={modal.roles} onConfirm={flow.handleBonusSlotRoleSelected} onClose={close} />
      )}

      {modal.type === 'detachmentSelector' && (
        <DetachmentSelectorModal
          trigger={modal.trigger}
          title={modal.title}
          faction={factionFor(modal.unlockedBy)}
          availability={(def) => {
            const force = forceOf(modal.unlockedBy);
            return force ? detachmentAvailability(forces, force, def, counts) : { status: 'ok' };
          }}
          onConfirm={flow.handleDetachmentSelected}
          onClose={close}
        />
      )}

      {modal.type === 'confirmClear' && (
        <ConfirmModal
          message="This slot unlocked one or more detachments with units in them. Clearing it will remove those detachments. Continue?"
          onConfirm={() => flow.doClear(modal.detachmentId, modal.slotKey, modal.affectedIds)}
          onClose={close}
        />
      )}

      {modal.type === 'additionalDetachmentSelector' && primary && (
        <DetachmentSelectorModal
          trigger="command"
          title="Add Detachment"
          faction={primary.faction}
          options={additionalDetachments}
          availability={(def) => detachmentAvailability(forces, primary, def, counts)}
          onConfirm={(def) => {
            addDetachment(def, { forceId: primary.id });
            close();
          }}
          onClose={close}
        />
      )}

      {modal.type === 'allySelector' && (
        <AllySelectorModal
          factions={allyFactions}
          onConfirm={(faction) => {
            addAlliedForce(faction);
            close();
          }}
          onClose={close}
        />
      )}

      {modal.type === 'confirmRemoveForce' && (
        <ConfirmModal
          message={
            forces.find((f) => f.id === modal.forceId)?.kind === 'lordOfWar'
              ? 'Remove the Lord of War Detachment and its units?'
              : `Remove the ${factionLabel(forces.find((f) => f.id === modal.forceId)?.faction ?? '')} allies and every detachment they unlocked?`
          }
          primaryButtonText="Remove"
          onConfirm={() => {
            removeForce(modal.forceId);
            close();
          }}
          onClose={close}
        />
      )}

      {modal.type === 'confirmRemoveDetachment' && (
        <ConfirmModal
          message={`Remove the ${getDetachmentDisplayName(
            detachments.find((d) => d.id === modal.detachmentId)?.def.name ?? 'detachment'
          )} and its units?`}
          primaryButtonText="Remove"
          onConfirm={() => {
            removeDetachment(modal.detachmentId);
            close();
          }}
          onClose={close}
        />
      )}

      {modal.type === 'export' && (
        <ExportModal forces={forces} allegiance={allegiance} pointsLimit={pointsLimit} totalPoints={totalPoints} onClose={close} />
      )}

      {modal.type === 'saveLoad' && <SavedListsModal onClose={close} />}

      {modal.type === 'confirmReset' && (
        <ConfirmModal
          message="Start a new list? Your current list will be lost unless you save it first."
          primaryButtonText="New List"
          onConfirm={() => {
            reset();
            close();
          }}
          onClose={close}
        />
      )}
    </React.Fragment>
  );
}
