import React from 'react';
import { ComposedModal, ModalHeader, ModalBody, ModalFooter, Button } from '@carbon/react';

const VALID_ROLES = [
  'Troops',
  'Transport',
  'Elites',
  'Heavy Assault',
  'Fast Attack',
  'Support',
  'Armour',
  'War Engine',
  'Retinue',
  'Commander',
  'Heavy Transport',
];

interface BonusSlotRoleSelectorModalProps {
  onConfirm: (role: string) => void;
  onClose: () => void;
}

export default function BonusSlotRoleSelectorModal({
  onConfirm,
  onClose,
}: BonusSlotRoleSelectorModalProps) {
  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title="Logistical Benefit" />
      <ModalBody hasForm>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {VALID_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => onConfirm(role)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                background: 'var(--cds-layer-02)',
                border: '1px solid var(--cds-border-subtle-01)',
                borderRadius: 4,
                color: 'var(--cds-text-primary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--cds-layer-hover-02)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--cds-layer-02)';
              }}
            >
              {role}
            </button>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
