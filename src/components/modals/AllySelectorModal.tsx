import React from 'react';
import { ComposedModal, ModalHeader, ModalBody, ModalFooter, Button } from '@carbon/react';
import type { FactionDef } from '../../data/factions';
import { FACTION_GROUPS } from '../../data/factions';

interface AllySelectorModalProps {
  factions: FactionDef[];
  onConfirm: (faction: string) => void;
  onClose: () => void;
}

export default function AllySelectorModal({ factions, onConfirm, onClose }: AllySelectorModalProps) {
  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title="Add Allied Detachment" />
      <ModalBody hasForm>
        <p style={{ color: 'var(--cds-text-secondary)', fontSize: 13, marginBottom: 16 }}>
          An Allied Detachment is a second army in your roster. Its Command choices can unlock its own
          Auxiliary detachments.
        </p>
        <div style={{ maxHeight: 440, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FACTION_GROUPS.map((group) => {
            const inGroup = factions.filter((f) => f.group === group);
            if (inGroup.length === 0) return null;
            return (
              <div key={group}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--cds-text-secondary)',
                    marginBottom: 4,
                  }}
                >
                  {group}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {inGroup.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onConfirm(f.id)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        background: 'var(--cds-layer-02)',
                        border: '1px solid transparent',
                        borderRadius: 2,
                        color: 'var(--cds-text-primary)',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--cds-layer-hover-02)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--cds-layer-02)';
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
