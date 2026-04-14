import React from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@carbon/react';
import type { DetachmentDef } from '../../types';
import { getDetachmentsForFaction, getDetachmentDisplayName } from '../../data/loader';
import { useRosterStore } from '../../store/rosterStore';
import { COHORT_DOCTRINE_BY_ID } from '../../constants/cohortDoctrines';

interface DetachmentSelectorModalProps {
  trigger: 'highCommand' | 'command';
  faction: string;
  title?: string;
  onConfirm: (def: DetachmentDef) => void;
  onClose: () => void;
}

export default function DetachmentSelectorModal({
  trigger,
  faction,
  title: titleProp,
  onConfirm,
  onClose,
}: DetachmentSelectorModalProps) {
  const cohortDoctrine = useRosterStore((s) => s.cohortDoctrine);
  const boostedTercio = cohortDoctrine ? COHORT_DOCTRINE_BY_ID[cohortDoctrine]?.boostedTercio : null;

  const options = getDetachmentsForFaction(
    trigger === 'highCommand' ? 'apex' : 'auxiliary',
    faction
  );

  const title =
    titleProp ??
    (trigger === 'highCommand' ? 'Choose Apex Detachment' : 'Choose Auxiliary Detachment');

  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title={title} />
      <ModalBody hasForm>
        <div
          style={{
            maxHeight: 440,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {options.map((def) => {
            const displayName = getDetachmentDisplayName(def.name);
            const slotSummary = def.slots
              .map((s) => `${s.max}× ${s.role.replace('Prime ', '★ ')}`)
              .join('  ·  ');
            const isDoctrineBoost = boostedTercio !== null && displayName === boostedTercio;

            return (
              <button
                key={def.name}
                onClick={() => onConfirm(def)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 2,
                  border: `1px solid ${isDoctrineBoost ? 'var(--cds-interactive)' : 'transparent'}`,
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
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: 'var(--cds-text-primary)', fontWeight: 500, fontSize: 14 }}>
                    {displayName}
                  </span>
                  {isDoctrineBoost && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--cds-interactive)',
                      border: '1px solid var(--cds-interactive)',
                      borderRadius: 2,
                      padding: '1px 5px',
                      lineHeight: 1.4,
                      whiteSpace: 'nowrap',
                    }}>
                      Doctrine Bonus
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--cds-text-secondary)', fontSize: 11, lineHeight: 1.4 }}>
                  {slotSummary}
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
      </ModalFooter>
    </ComposedModal>
  );
}
