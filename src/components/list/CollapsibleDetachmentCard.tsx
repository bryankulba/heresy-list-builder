import React from 'react';
import { Tag } from '@carbon/react';
import { ChevronDown } from '@carbon/icons-react';
import type { BonusSlot, FilledSlot, PlacedDetachment, SlotDef } from '../../types';
import { getDetachmentDisplayName } from '../../data/loader';
import { expandSlots, groupByRole } from '../canvas/DetachmentCard';
import Slot from '../canvas/Slot';

function detachmentTagType(type: string) {
  switch (type) {
    case 'core': return 'blue';
    case 'auxiliary': return 'teal';
    case 'apex': return 'purple';
    default: return 'gray';
  }
}

function detachmentTypeLabel(type: string) {
  switch (type) {
    case 'core': return 'Core';
    case 'auxiliary': return 'Auxiliary';
    case 'apex': return 'Apex';
    default: return type;
  }
}

interface CollapsibleDetachmentCardProps {
  detachment: PlacedDetachment;
  instanceNumber?: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSlotClick: (slotKey: string, slotDef: SlotDef) => void;
  onSlotClear: (slotKey: string) => void;
  onBonusSlotClick: (bonusSlotId: string, role: string) => void;
  onBonusSlotClear: (bonusSlotId: string) => void;
}

export default function CollapsibleDetachmentCard({
  detachment,
  instanceNumber,
  isExpanded,
  onToggle,
  onSlotClick,
  onSlotClear,
  onBonusSlotClick,
  onBonusSlotClear,
}: CollapsibleDetachmentCardProps) {
  const displayName = getDetachmentDisplayName(detachment.def.name);
  const title = instanceNumber != null ? `${displayName} #${instanceNumber}` : displayName;
  const expanded = expandSlots(detachment.def);
  const groups = groupByRole(expanded);
  const tagType = detachmentTagType(detachment.def.type) as 'blue' | 'teal' | 'purple' | 'gray';

  const totalSlots = expanded.length + (detachment.bonusSlots?.length ?? 0);
  const filledSlots =
    expanded.filter(({ key }) => !!detachment.slots[key]).length +
    (detachment.bonusSlots?.filter((b) => b.unit !== null).length ?? 0);

  const cardPoints = Object.values(detachment.slots).reduce((sum, fs) => {
    return sum + (fs?.unit.points ?? 0);
  }, 0);

  return (
    <div
      style={{
        background: 'var(--cds-layer-01)',
        border: '1px solid var(--cds-border-strong-01)',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* Header — always visible, clickable */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          gap: 8,
          textAlign: 'left',
        }}
      >
        {/* Name + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span
            style={{
              color: 'var(--cds-text-primary)',
              fontSize: 13,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          <Tag type={tagType} size="sm">
            {detachmentTypeLabel(detachment.def.type)}
          </Tag>
        </div>

        {/* Right: points + fill count + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {cardPoints > 0 && (
            <span style={{ color: 'var(--cds-text-secondary)', fontSize: 12 }}>
              {cardPoints}pts
            </span>
          )}
          <span style={{ color: 'var(--cds-text-secondary)', fontSize: 12 }}>
            {filledSlots} / {totalSlots}
          </span>
          <ChevronDown
            size={16}
            style={{
              color: 'var(--cds-icon-primary)',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              flexShrink: 0,
            }}
          />
        </div>
      </button>

      {/* Expanded slot grid */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isExpanded ? 2000 : 0,
          transition: 'max-height 0.25s ease',
        }}
      >
        <div
          style={{
            padding: '0 14px 14px',
            borderTop: '1px solid var(--cds-border-subtle-01)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            paddingTop: 12,
          }}
        >
          {groups.map((group) => (
            <div key={group.displayRole}>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {group.slots.map(({ key, slotDef }) => (
                  <Slot
                    key={key}
                    slotDef={slotDef}
                    filled={detachment.slots[key]}
                    onClick={() => onSlotClick(key, slotDef)}
                    onClear={() => onSlotClear(key)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Logistical Benefit bonus slots */}
          {(detachment.bonusSlots ?? []).length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--cds-support-warning)',
                  marginBottom: 5,
                  paddingBottom: 3,
                  borderBottom: '1px dashed var(--cds-support-warning)',
                }}
              >
                Logistical Benefit
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(detachment.bonusSlots ?? []).map((bs: BonusSlot) => {
                  const fakeSlotDef: SlotDef = { role: bs.role, min: 0, max: 1, prime: false };
                  const filledSlot: FilledSlot | null = bs.unit ? { unit: bs.unit } : null;
                  return (
                    <Slot
                      key={bs.id}
                      slotDef={fakeSlotDef}
                      filled={filledSlot}
                      onClick={() => onBonusSlotClick(bs.id, bs.role)}
                      onClear={() => onBonusSlotClear(bs.id)}
                      isDashed
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
