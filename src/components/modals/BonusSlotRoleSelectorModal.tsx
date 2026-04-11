import React, { useState } from 'react';
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
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title="Logistical Benefit" />
      <ModalBody hasForm>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {VALID_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => setSelected(role)}
              style={{
                textAlign: 'left',
                padding: '10px 14px',
                background: selected === role ? 'var(--cds-layer-accent-01)' : 'var(--cds-layer-02)',
                border: `1px solid ${selected === role ? 'var(--cds-interactive)' : 'var(--cds-border-subtle-01)'}`,
                borderRadius: 4,
                color: 'var(--cds-text-primary)',
                fontSize: 13,
                cursor: 'pointer',
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
        <Button kind="primary" disabled={!selected} onClick={() => selected && onConfirm(selected)}>
          Add Slot
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
