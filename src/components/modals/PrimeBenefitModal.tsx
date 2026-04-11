import React from 'react';
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
  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title="Select Prime Benefit" />
      <ModalBody hasForm>
        <p style={{ color: 'var(--cds-text-secondary)', fontSize: 13, marginBottom: 16 }}>
          This is a prime slot. Choose a benefit for the unit filling it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PRIME_BENEFITS.map((benefit) => (
            <button
              key={benefit.id}
              onClick={() => onConfirm(benefit)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 2,
                border: '1px solid var(--cds-border-subtle-01)',
                background: 'var(--cds-layer-02)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--cds-layer-hover-02)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--cds-layer-02)';
              }}
            >
              <div style={{ color: 'var(--cds-text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {benefit.name}
              </div>
              <div style={{ color: 'var(--cds-text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                {benefit.description}
              </div>
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
