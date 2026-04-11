import React, { useState } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@carbon/react';
import type { DetachmentDef } from '../../types';
import { getDetachmentsForFaction, getDetachmentDisplayName } from '../../data/loader';

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
  const [selected, setSelected] = useState<DetachmentDef | null>(null);

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
            maxHeight: 400,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {options.map((def) => {
            const displayName = getDetachmentDisplayName(def.name);
            const isSelected = selected?.name === def.name;
            const slotSummary = def.slots
              .map((s) => `${s.max}× ${s.role.replace('Prime ', '★ ')}`)
              .join('  ·  ');

            return (
              <button
                key={def.name}
                onClick={() => setSelected(def)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 2,
                  border: `1px solid ${isSelected ? 'var(--cds-interactive)' : 'transparent'}`,
                  background: isSelected
                    ? 'var(--cds-layer-selected-01)'
                    : 'var(--cds-layer-02)',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    color: 'var(--cds-text-primary)',
                    fontWeight: 500,
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  {displayName}
                </div>
                <div
                  style={{
                    color: 'var(--cds-text-secondary)',
                    fontSize: 11,
                    lineHeight: 1.4,
                  }}
                >
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
        <Button
          kind="primary"
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
        >
          Add to Canvas
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
