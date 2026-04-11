import React, { useMemo } from 'react';
import { ComposedModal, ModalHeader, ModalBody, ModalFooter, Button } from '@carbon/react';
import type { Allegiance, PlacedDetachment } from '../../types';
import { getDetachmentDisplayName } from '../../data/loader';
import { expandSlots } from '../canvas/DetachmentCard';
import { FACTION_LABEL_MAP } from '../../data/factions';

interface ExportModalProps {
  detachments: PlacedDetachment[];
  faction: string;
  allegiance: Allegiance;
  pointsLimit: number;
  totalPoints: number;
  onClose: () => void;
}

function factionLabel(faction: string): string {
  return (FACTION_LABEL_MAP[faction] ?? faction).toUpperCase();
}

function buildExportText(
  detachments: PlacedDetachment[],
  faction: string,
  allegiance: Allegiance,
  pointsLimit: number,
  totalPoints: number
): string {
  const lines: string[] = [];

  lines.push(`${factionLabel(faction)} — ${allegiance.toUpperCase()} — ${pointsLimit}pts`);
  lines.push('');

  for (const det of detachments) {
    const displayName = getDetachmentDisplayName(det.def.name).toUpperCase();
    lines.push(displayName);

    const expanded = expandSlots(det.def);
    for (const { key, slotDef } of expanded) {
      const filled = det.slots[key];
      if (!filled) continue;
      const benefitStr = filled.primeBenefit ? `  [Prime: ${filled.primeBenefit.name}]` : '';
      const role = slotDef.role.replace('Prime ', '★ ');
      lines.push(`  ${role}: ${filled.unit.name} (${filled.unit.points}pts)${benefitStr}`);
    }
    for (const bs of det.bonusSlots ?? []) {
      if (!bs.unit) continue;
      lines.push(`  ${bs.role} [Logistical Benefit]: ${bs.unit.name} (${bs.unit.points}pts)`);
    }

    lines.push('');
  }

  lines.push(`TOTAL: ${totalPoints}pts / ${pointsLimit}pts`);

  return lines.join('\n');
}

export default function ExportModal({
  detachments,
  faction,
  allegiance,
  pointsLimit,
  totalPoints,
  onClose,
}: ExportModalProps) {
  const text = useMemo(
    () => buildExportText(detachments, faction, allegiance, pointsLimit, totalPoints),
    [detachments, faction, allegiance, pointsLimit, totalPoints]
  );

  function copyToClipboard() {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title="Export List" />
      <ModalBody hasForm>
        <pre
          style={{
            background: 'var(--cds-layer-02)',
            border: '1px solid var(--cds-border-subtle-01)',
            borderRadius: 2,
            padding: 16,
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--cds-text-primary)',
            whiteSpace: 'pre-wrap',
            overflowY: 'auto',
            maxHeight: 400,
          }}
        >
          {text}
        </pre>
        <p style={{ color: 'var(--cds-text-secondary)', fontSize: 12, marginTop: 12 }}>
          BattleScribe .ros export coming soon.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          Close
        </Button>
        <Button kind="primary" onClick={copyToClipboard}>
          Copy to Clipboard
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
