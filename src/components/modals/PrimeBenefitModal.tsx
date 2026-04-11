import React, { useState } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@carbon/react';
import type { PrimeBenefit } from '../../types';
import { PRIME_BENEFITS } from '../../constants/primeBenefits';

interface PrimeBenefitModalProps {
  onConfirm: (benefit: PrimeBenefit) => void;
  onClose: () => void;
}

export default function PrimeBenefitModal({ onConfirm, onClose }: PrimeBenefitModalProps) {
  const [selected, setSelected] = useState<PrimeBenefit | null>(null);

  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title="Select Prime Benefit" />
      <ModalBody hasForm>
        <p style={{ color: 'var(--cds-text-secondary)', fontSize: 13, marginBottom: 16 }}>
          This is a prime slot. Choose a benefit for the unit filling it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PRIME_BENEFITS.map((benefit) => {
            const isSelected = selected?.id === benefit.id;
            return (
              <button
                key={benefit.id}
                onClick={() => setSelected(benefit)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 2,
                  border: `1px solid ${isSelected ? 'var(--cds-support-warning)' : 'var(--cds-border-subtle-01)'}`,
                  background: isSelected ? 'var(--cds-layer-selected-01)' : 'var(--cds-layer-02)',
                  cursor: 'pointer',
                  boxShadow: isSelected ? `0 0 0 1px var(--cds-support-warning)` : undefined,
                }}
              >
                <div
                  style={{
                    color: isSelected ? 'var(--cds-support-warning)' : 'var(--cds-text-primary)',
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  {benefit.name}
                </div>
                <div style={{ color: 'var(--cds-text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                  {benefit.description}
                </div>
              </button>
            );
          })}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          kind="primary"
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
        >
          Next: Choose Unit
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
