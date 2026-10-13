import React from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@carbon/react';
import type { PrimeOption } from '../../rules/primeBenefits';
import { noFocusScroll } from './noFocusScroll';

interface PrimeBenefitModalProps {
  /** Benefits this unit may take in this slot (from BSData) */
  options: PrimeOption[];
  onConfirm: (benefit: PrimeOption) => void;
  onClose: () => void;
}

export default function PrimeBenefitModal({ options, onConfirm, onClose }: PrimeBenefitModalProps) {
  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title="Select Prime Benefit" />
      <ModalBody hasForm>
        <p style={{ color: 'var(--cds-text-secondary)', fontSize: 13, marginBottom: 16 }}>
          This is a prime slot. Choose a benefit for the unit filling it.
        </p>
        {options.length === 0 && (
          <p style={{ color: 'var(--cds-text-secondary)', fontSize: 14 }}>
            No Prime benefits are available to this unit in this slot.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {options.map((benefit) => (
            <button
              key={benefit.id}
              onMouseDown={noFocusScroll}
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
              {benefit.description && (
                <div
                  title={benefit.description}
                  style={{
                    color: 'var(--cds-text-secondary)',
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-line',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {benefit.description}
                </div>
              )}
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
