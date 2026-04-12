import React, { useState } from 'react';
import { ComposedModal, ModalHeader, ModalBody, ModalFooter, Button, TextInput, NumberInput } from '@carbon/react';
import type { FilledSlot, SlotDef } from '../../types';
import { getBaseRole, stripPrimePrefix, getDetachmentDisplayName } from '../../data/loader';

export interface LinkedDetachmentRow {
  name: string;
  onChange: () => void;
}

interface SlotEditModalProps {
  slotDef: SlotDef;
  filled: FilledSlot;
  /** Apex/aux detachments unlocked by this slot (1 for normal Command, 2 for Officer of the Line) */
  linkedDetachments?: LinkedDetachmentRow[];
  onChangeUnit: () => void;
  onChangeBenefit: () => void;
  onAnnotationsChange: (notes: string, extraPoints: number) => void;
  onClose: () => void;
}

export default function SlotEditModal({
  slotDef,
  filled,
  linkedDetachments,
  onChangeUnit,
  onChangeBenefit,
  onAnnotationsChange,
  onClose,
}: SlotEditModalProps) {
  const displayRole = getBaseRole(stripPrimePrefix(slotDef.role));
  const [notes, setNotes] = useState(filled.notes ?? '');
  const [extraPoints, setExtraPoints] = useState(filled.extraPoints ?? 0);

  function handleNotesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNotes(val);
    onAnnotationsChange(val, extraPoints);
  }

  function handleExtraPointsChange(_e: unknown, { value }: { value: string | number }) {
    const num = typeof value === 'number' ? value : parseInt(value as string, 10);
    const val = isNaN(num) ? 0 : Math.max(0, num);
    setExtraPoints(val);
    onAnnotationsChange(notes, val);
  }

  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title={displayRole} />
      <ModalBody hasForm>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Unit row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '12px 14px',
              background: 'var(--cds-layer-02)',
              border: '1px solid var(--cds-border-subtle-01)',
              borderRadius: 4,
            }}
          >
            <div>
              <div
                style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cds-text-secondary)', marginBottom: 3 }}
              >
                Unit
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cds-text-primary)' }}>
                {filled.unit.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', marginTop: 2 }}>
                {filled.unit.points}pts
              </div>
            </div>
            <Button kind="ghost" size="sm" onClick={onChangeUnit}>
              Change
            </Button>
          </div>

          {/* Linked detachment rows — one per unlocked detachment (2 for Officer of the Line) */}
          {linkedDetachments?.map((linked, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 14px',
                background: 'var(--cds-layer-02)',
                border: '1px solid var(--cds-border-subtle-01)',
                borderRadius: 4,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cds-text-secondary)', marginBottom: 3 }}
                >
                  {linkedDetachments.length > 1 ? `Linked Detachment ${i + 1}` : 'Linked Detachment'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: linked.name ? 'var(--cds-text-primary)' : 'var(--cds-text-placeholder)' }}>
                  {linked.name ? getDetachmentDisplayName(linked.name) : 'None selected'}
                </div>
              </div>
              <Button kind="ghost" size="sm" onClick={linked.onChange}>
                {linked.name ? 'Change' : 'Select'}
              </Button>
            </div>
          ))}

          {/* Prime benefit row — only shown for prime slots */}
          {slotDef.prime && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 14px',
                background: 'var(--cds-layer-02)',
                border: '1px solid var(--cds-support-warning)',
                borderRadius: 4,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cds-support-warning)', marginBottom: 3 }}
                >
                  Prime Benefit
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cds-text-primary)' }}>
                  {filled.primeBenefit?.name ?? '—'}
                </div>
              </div>
              <Button kind="ghost" size="sm" onClick={onChangeBenefit}>
                Change
              </Button>
            </div>
          )}

          {/* Loadout annotations */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <TextInput
                id="slot-notes"
                labelText="Loadout Notes"
                placeholder="e.g. with plasma guns"
                value={notes}
                onChange={handleNotesChange}
                size="sm"
              />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <NumberInput
                id="slot-extra-points"
                label="Extra Points"
                value={extraPoints}
                min={0}
                onChange={handleExtraPointsChange}
                size="sm"
                hideSteppers
              />
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          Done
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
