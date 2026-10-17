import React from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@carbon/react';
import type { DetachmentDef } from '../../types';
import type { DetachmentAvailability } from '../../rules/options';
import { getDetachmentsForFaction, getDetachmentDisplayName } from '../../data/loader';
import { noFocusScroll } from './noFocusScroll';

interface DetachmentSelectorModalProps {
  trigger: 'highCommand' | 'command';
  faction: string;
  /** The force's chart (Zone Mortalis armies pick from their own chart) */
  chart?: string;
  title?: string;
  /** Explicit options; defaults to the Apex/Auxiliary detachments for the trigger */
  options?: DetachmentDef[];
  /**
   * Whether to offer a detachment: hidden ones aren't listed; locked ones (a
   * unit would unlock them) are listed last, dimmed, with the reason, and stay
   * selectable
   */
  availability?: (def: DetachmentDef) => DetachmentAvailability;
  onConfirm: (def: DetachmentDef) => void;
  onClose: () => void;
  /** The dismiss button: "Decide later" when a unit's unlock is being chosen (the unit stays), else "Cancel" */
  dismissLabel?: string;
}

export default function DetachmentSelectorModal({
  trigger,
  faction,
  chart,
  title: titleProp,
  options: optionsProp,
  availability = () => ({ status: 'ok' }),
  onConfirm,
  onClose,
  dismissLabel = 'Cancel',
}: DetachmentSelectorModalProps) {

  const allOptions =
    optionsProp ?? getDetachmentsForFaction(trigger === 'highCommand' ? 'apex' : 'auxiliary', faction, chart);
  const status = new Map(allOptions.map((d) => [d, availability(d)]));
  const locked = new Set(allOptions.filter((d) => status.get(d)?.status === 'locked'));
  const shown = allOptions.filter((d) => status.get(d)?.status !== 'hidden');
  const options = [...shown.filter((d) => !locked.has(d)), ...shown.filter((d) => locked.has(d))];
  const firstLocked = options.find((d) => locked.has(d));

  const title =
    titleProp ??
    (trigger === 'highCommand' ? 'Choose Apex Detachment' : 'Choose Auxiliary Detachment');

  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title={title} />
      <ModalBody hasForm>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {options.map((def) => {
            const displayName = getDetachmentDisplayName(def.name);
            const slotSummary = def.slots
              .filter((s) => s.max > 0)
              .map((s) => `${s.max}× ${s.role.replace('Prime ', '★ ')}`)
              .join('  ·  ');
            const isLockedDef = locked.has(def);

            return (
              <React.Fragment key={def.name}>
              {def === firstLocked && (
                <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', margin: '10px 2px 2px' }}>
                  Not unlocked yet — taking one shows a warning
                </div>
              )}
              <button
                onMouseDown={noFocusScroll}
                onClick={() => onConfirm(def)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 2,
                  border: '1px solid transparent',
                  background: 'var(--cds-layer-02)',
                  cursor: 'pointer',
                  opacity: isLockedDef ? 0.55 : 1,
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
                </div>
                <div style={{ color: 'var(--cds-text-secondary)', fontSize: 11, lineHeight: 1.4 }}>
                  {slotSummary}
                </div>
                {isLockedDef && (() => {
                  const s = status.get(def);
                  return s?.status === 'locked' && s.reason ? (
                    <div style={{ color: 'var(--cds-support-warning)', fontSize: 11, marginTop: 3 }}>{s.reason}</div>
                  ) : null;
                })()}
              </button>
              </React.Fragment>
            );
          })}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          {dismissLabel}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
