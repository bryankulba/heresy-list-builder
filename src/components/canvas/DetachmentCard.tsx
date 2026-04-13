import React from 'react';
import { Tag } from '@carbon/react';
import type { BonusSlot, FilledSlot, PlacedDetachment, SlotDef } from '../../types';
import { getDetachmentDisplayName, getBaseRole, stripPrimePrefix } from '../../data/loader';
import Slot from './Slot';

interface ExpandedSlot {
  key: string;
  slotDef: SlotDef;
}

export function expandSlots(def: PlacedDetachment['def']): ExpandedSlot[] {
  // Drop qualifier slots (e.g. "Command - Centurions Only") only when a parent
  // slot with the base role exists in the same detachment. Qualifier slots that
  // ARE the primary slot (e.g. Solar Auxilia "Troops - Lasrifle Section Units only")
  // are kept because no parent "Troops" slot exists alongside them.
  const relevant = def.slots.filter(s => {
    if (!s.role.includes(' - ')) return true;
    const baseRole = s.role.split(' - ')[0];
    return !def.slots.some(other => other.role === baseRole);
  });

  const primeSlots = relevant.filter(s => s.prime);
  const regularSlots = relevant.filter(s => !s.prime);

  const result: ExpandedSlot[] = [];

  // Iterate regular slots in BSData order to preserve role group ordering.
  // Within each role: prime slot(s) first, then remaining regular slots.
  for (const regular of regularSlots) {
    // For qualifier slots (e.g. "Troops - Lasrifle Section Units only"), match
    // prime slots against the base role ("Troops") so "Prime Troops" pairs correctly.
    const regularBase = regular.role.includes(' - ') ? regular.role.split(' - ')[0] : regular.role;
    const prime = primeSlots.find(p => p.role.replace(/^Prime /, '') === regularBase);
    const primeCount = prime?.max ?? 0;

    if (prime) {
      for (let i = 0; i < prime.max; i++) {
        result.push({ key: `${prime.role}-${i}`, slotDef: prime });
      }
    }

    const remaining = regular.max - primeCount;
    for (let i = 0; i < remaining; i++) {
      result.push({ key: `${regular.role}-${primeCount + i}`, slotDef: regular });
    }
  }

  return result;
}

function detachmentTagType(type: string): string {
  switch (type) {
    case 'core': return 'blue';
    case 'auxiliary': return 'teal';
    case 'apex': return 'purple';
    default: return 'gray';
  }
}

function detachmentTypeLabel(type: string): string {
  switch (type) {
    case 'core': return 'Core';
    case 'auxiliary': return 'Auxiliary';
    case 'apex': return 'Apex';
    default: return type;
  }
}

interface SlotGroup {
  displayRole: string;
  slots: ExpandedSlot[];
}

export function groupByRole(expanded: ExpandedSlot[]): SlotGroup[] {
  const groups: SlotGroup[] = [];
  const seen = new Map<string, SlotGroup>();
  for (const es of expanded) {
    const displayRole = getBaseRole(stripPrimePrefix(es.slotDef.role));
    if (!seen.has(displayRole)) {
      const group: SlotGroup = { displayRole, slots: [] };
      groups.push(group);
      seen.set(displayRole, group);
    }
    seen.get(displayRole)!.slots.push(es);
  }
  return groups;
}

interface DetachmentCardProps {
  detachment: PlacedDetachment;
  instanceNumber?: number; // set when >1 of the same name exists
  onSlotClick: (slotKey: string, slotDef: SlotDef) => void;
  onSlotClear: (slotKey: string) => void;
  onBonusSlotClick: (bonusSlotId: string, role: string) => void;
  onBonusSlotClear: (bonusSlotId: string) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  slotRefCallback?: (slotKey: string) => (el: HTMLDivElement | null) => void;
}

export default function DetachmentCard({
  detachment,
  instanceNumber,
  onSlotClick,
  onSlotClear,
  onBonusSlotClick,
  onBonusSlotClear,
  cardRef,
  slotRefCallback,
}: DetachmentCardProps) {
  const displayName = getDetachmentDisplayName(detachment.def.name);
  const title = instanceNumber != null ? `${displayName} #${instanceNumber}` : displayName;
  const expanded = expandSlots(detachment.def);
  const groups = groupByRole(expanded);
  const tagType = detachmentTagType(detachment.def.type) as
    | 'blue'
    | 'teal'
    | 'purple'
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
        </div>
        {cardPoints > 0 && (
          <span
            className="text-xs shrink-0"
            style={{ color: 'var(--cds-text-secondary)' }}
          >
            {cardPoints}pts
          </span>
        )}
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
  );
}
