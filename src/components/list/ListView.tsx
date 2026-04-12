import React, { useState } from 'react';
import type { PlacedDetachment, SlotDef } from '../../types';
import CollapsibleDetachmentCard from './CollapsibleDetachmentCard';

function sortDetachments(detachments: PlacedDetachment[]): PlacedDetachment[] {
  const primary = detachments.find((d) => d.def.name === 'Crusade Primary Detachment');
  const warlord = detachments.find((d) => d.def.name === 'Warlord Detachment');
  const apex = detachments.filter((d) => d.unlockedBy && d.def.type === 'apex');
  const auxiliaries = detachments.filter((d) => d.unlockedBy && d.def.type === 'auxiliary');
  const others = detachments.filter(
    (d) =>
      d.def.name !== 'Crusade Primary Detachment' &&
      d.def.name !== 'Warlord Detachment' &&
      !d.unlockedBy
  );

  return [
    ...(primary ? [primary] : []),
    ...apex,
    ...auxiliaries,
    ...(warlord ? [warlord] : []),
    ...others,
  ];
}

function computeInstanceNumbers(dets: PlacedDetachment[]): Map<string, number | undefined> {
  const countByName = new Map<string, number>();
  const result = new Map<string, number | undefined>();
  for (const d of dets) {
    countByName.set(d.def.name, (countByName.get(d.def.name) ?? 0) + 1);
  }
  const seenByName = new Map<string, number>();
  for (const d of dets) {
    const name = d.def.name;
    if ((countByName.get(name) ?? 0) > 1) {
      const idx = (seenByName.get(name) ?? 0) + 1;
      seenByName.set(name, idx);
      result.set(d.id, idx);
    } else {
      result.set(d.id, undefined);
    }
  }
  return result;
}

interface ListViewProps {
  detachments: PlacedDetachment[];
  onSlotClick: (detachmentId: string, slotKey: string, slotDef: SlotDef) => void;
  onSlotClear: (detachmentId: string, slotKey: string) => void;
  onBonusSlotClick: (detachmentId: string, bonusSlotId: string, role: string) => void;
  onBonusSlotClear: (detachmentId: string, bonusSlotId: string) => void;
}

export default function ListView({
  detachments,
  onSlotClick,
  onSlotClear,
  onBonusSlotClick,
  onBonusSlotClear,
}: ListViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = sortDetachments(detachments);
  const instanceNumbers = computeInstanceNumbers(sorted);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        paddingTop: 64, // 48px Carbon fixed header + 16px gap
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 12,
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        {sorted.map((det) => (
          <CollapsibleDetachmentCard
            key={det.id}
            detachment={det}
            instanceNumber={instanceNumbers.get(det.id)}
            isExpanded={expandedId === det.id}
            onToggle={() => handleToggle(det.id)}
            onSlotClick={(slotKey, slotDef) => onSlotClick(det.id, slotKey, slotDef)}
            onSlotClear={(slotKey) => onSlotClear(det.id, slotKey)}
            onBonusSlotClick={(bonusSlotId, role) => onBonusSlotClick(det.id, bonusSlotId, role)}
            onBonusSlotClear={(bonusSlotId) => onBonusSlotClear(det.id, bonusSlotId)}
          />
        ))}
      </div>
    </div>
  );
}
