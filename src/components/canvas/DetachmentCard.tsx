import React from 'react';
import { Tag } from '@carbon/react';
import { Close, WarningAltFilled } from '@carbon/icons-react';
import type { PlacedDetachment, SlotDef } from '../../types';
import { getDetachmentDisplayName } from '../../data/loader';
import { cardSlots, groupByRole } from './slotLayout';

export { cardSlots, estimateCardHeight, expandSlots, groupByRole } from './slotLayout';
import Slot from './Slot';

function detachmentTagType(type: string): string {
  switch (type) {
    case 'core': return 'blue';
    case 'auxiliary': return 'teal';
    case 'apex': return 'purple';
    case 'allied': return 'cyan';
    case 'additional': return 'teal';
    case 'lordOfWar': return 'magenta';
    default: return 'gray';
  }
}

function detachmentTypeLabel(type: string): string {
  switch (type) {
    case 'core': return 'Core';
    case 'auxiliary': return 'Auxiliary';
    case 'apex': return 'Apex';
    case 'allied': return 'Allied';
    case 'additional': return 'Additional';
    case 'lordOfWar': return 'Lord of War';
    default: return type;
  }
}

interface DetachmentCardProps {
  detachment: PlacedDetachment;
  instanceNumber?: number; // set when >1 of the same name exists
  /** Label of the allied faction, when this card belongs to an allied army */
  allyFaction?: string;
  /** When set, the card shows a remove button */
  onRemove?: () => void;
  /** Roster warnings about this detachment (a badge on the card; slot warnings outline their slot) */
  warnings?: Array<{ message: string; slotKey?: string }>;
  onSlotClick: (slotKey: string, slotDef: SlotDef) => void;
  onSlotClear: (slotKey: string) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  slotRefCallback?: (slotKey: string) => (el: HTMLDivElement | null) => void;
}

export default function DetachmentCard({
  detachment,
  instanceNumber,
  allyFaction,
  onRemove,
  warnings = [],
  onSlotClick,
  onSlotClear,
  cardRef,
  slotRefCallback,
}: DetachmentCardProps) {
  const displayName = getDetachmentDisplayName(detachment.def.name);
  const title = instanceNumber != null ? `${displayName} #${instanceNumber}` : displayName;
  const groups = groupByRole(cardSlots(detachment));
  const tagType = detachmentTagType(detachment.def.type) as
    | 'blue'
    | 'teal'
    | 'purple'
    | 'cyan'
    | 'magenta'
    | 'gray';

  // Points on this card
  const cardPoints = Object.values(detachment.slots).reduce((sum, fs) => {
    if (!fs) return sum;
    let pts = fs.unit.points;
    // bonusUnit removed — bonus slots tracked separately in detachment.bonusSlots
    return sum + pts;
  }, 0);

  return (
    <div
      ref={cardRef}
      style={{
        background: 'var(--cds-layer-01)',
        border: '1px solid var(--cds-border-strong-01)',
        borderRadius: 4,
        padding: 16,
        minWidth: 300,
        maxWidth: 400,
        width: '100%',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-semibold text-sm leading-tight"
            style={{ color: 'var(--cds-text-primary)' }}
          >
            {title}
          </span>
          <Tag type={tagType} size="sm">
            {detachmentTypeLabel(detachment.def.type)}
          </Tag>
          {allyFaction && detachment.def.type !== 'allied' && (
            <Tag type="cyan" size="sm">
              {allyFaction}
            </Tag>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {warnings.length > 0 && (
            <span
              title={warnings.map((w) => w.message).join('\n')}
              aria-label={`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--cds-support-error)', fontSize: 12 }}
            >
              <WarningAltFilled size={16} />
              {warnings.length > 1 && warnings.length}
            </span>
          )}
          {cardPoints > 0 && (
            <span className="text-xs" style={{ color: 'var(--cds-text-secondary)' }}>
              {cardPoints}pts
            </span>
          )}
          {onRemove && (
            <button
              data-interactive
              onClick={onRemove}
              aria-label={`Remove ${title}`}
              title="Remove detachment"
              style={{
                background: 'none',
                border: 'none',
                padding: 2,
                cursor: 'pointer',
                color: 'var(--cds-icon-secondary)',
                display: 'flex',
              }}
            >
              <Close size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Slot rows grouped by role */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map((group) => (
          <div key={group.displayRole}>
            {/* Role heading */}
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--cds-text-secondary)',
                marginBottom: 5,
                paddingBottom: 3,
                borderBottom: '1px solid var(--cds-border-subtle-01)',
              }}
            >
              {group.displayRole}
            </div>
            {/* Slots in this group */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.slots.map(({ key, slotDef }) => (
                <Slot
                  key={key}
                  slotDef={slotDef}
                  filled={detachment.slots[key]}
                  onClick={() => onSlotClick(key, slotDef)}
                  onClear={() => onSlotClear(key)}
                  slotRef={slotRefCallback ? slotRefCallback(key) : undefined}
                  warnings={warnings.filter((w) => w.slotKey === key).map((w) => w.message)}
                />
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
