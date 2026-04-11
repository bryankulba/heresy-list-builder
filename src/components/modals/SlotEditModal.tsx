import React from 'react';
import { ComposedModal, ModalHeader, ModalBody, ModalFooter, Button } from '@carbon/react';
import type { FilledSlot, SlotDef } from '../../types';
import { getBaseRole, stripPrimePrefix, getDetachmentDisplayName } from '../../data/loader';

interface SlotEditModalProps {
  slotDef: SlotDef;
  filled: FilledSlot;
  /** Name of the apex/aux detachment unlocked by this slot, if any */
  unlockedDetachmentName?: string;
  onChangeUnit: () => void;
  onChangeBenefit: () => void;
  /** Called when user wants to change (or add) the linked detachment */
  onChangeDetachment?: () => void;
  onClose: () => void;
}

export default function SlotEditModal({
  slotDef,
  filled,
  unlockedDetachmentName,
  onChangeUnit,
  onChangeBenefit,
  onChangeDetachment,
  onClose,
}: SlotEditModalProps) {
  const displayRole = getBaseRole(stripPrimePrefix(slotDef.role));

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

          {/* Linked detachment row — only shown for HC/Command slots */}
          {onChangeDetachment && (
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
                  Linked Detachment
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: unlockedDetachmentName ? 'var(--cds-text-primary)' : 'var(--cds-text-placeholder)' }}>
                  {unlockedDetachmentName ? getDetachmentDisplayName(unlockedDetachmentName) : 'None selected'}
                </div>
              </div>
              <Button kind="ghost" size="sm" onClick={onChangeDetachment}>
                {unlockedDetachmentName ? 'Change' : 'Select'}
              </Button>
            </div>
          )}

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
