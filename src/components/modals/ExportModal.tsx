import React, { useMemo, useState } from 'react';
import { ComposedModal, ModalHeader, ModalBody, ModalFooter, Button } from '@carbon/react';
import type { Allegiance, Force, PlacedDetachment } from '../../types';
import { getDetachmentDisplayName } from '../../data/loader';
import { cardSlots } from '../canvas/DetachmentCard';
import { factionLabel } from '../../data/factions';
import { buildRosXml } from '../../utils/buildRos';
import { withEffectiveSlots } from '../../rules/slots';
import { useRosterStore } from '../../store/rosterStore';

interface ExportModalProps {
  forces: Force[];
  allegiance: Allegiance;
  pointsLimit: number;
  totalPoints: number;
  onClose: () => void;
}

function detachmentLines(det: PlacedDetachment): string[] {
  const lines = [getDetachmentDisplayName(det.def.name).toUpperCase()];

  for (const { key, slotDef } of cardSlots(det)) {
    const filled = det.slots[key];
    if (!filled) continue;
    const benefitStr = filled.primeBenefit
      ? `  [Prime: ${filled.primeBenefit.name}${filled.lbRole ? ` — ${filled.lbRole}` : ''}]`
      : '';
    const role = slotDef.role.replace('Prime ', '★ ');
    const effectivePts = filled.unit.points + (filled.extraPoints ?? 0);
    const notesStr = filled.notes ? `  — ${filled.notes}` : '';
    lines.push(`  ${role}: ${filled.unit.name} (${effectivePts}pts)${benefitStr}${notesStr}`);
  }
  return lines;
}

function buildExportText(
  forces: Force[],
  allegiance: Allegiance,
  pointsLimit: number,
  totalPoints: number
): string {
  const lines: string[] = [];
  const primary = forces.find((f) => f.kind === 'primary') ?? forces[0];

  lines.push(`${factionLabel(primary?.faction ?? '').toUpperCase()} — ${allegiance.toUpperCase()} — ${pointsLimit}pts`);
  lines.push('');

  for (const force of forces) {
    if (force.kind === 'allied') {
      lines.push(`=== ALLIES: ${factionLabel(force.faction).toUpperCase()} ===`);
      lines.push('');
    }
    if (force.kind === 'lordOfWar') {
      lines.push('=== LORD OF WAR ===');
      lines.push('');
    }
    for (const det of force.detachments) {
      lines.push(...detachmentLines(det), '');
    }
  }

  lines.push(`TOTAL: ${totalPoints}pts / ${pointsLimit}pts`);

  return lines.join('\n');
}

function rosFile(xml: string, faction: string): File {
  return new File([xml], `${faction}.ros`, { type: 'application/xml' });
}

/** Phones and tablets: the system share sheet (New Recruit, Files, Messages…) instead of a download. */
function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [rosFile('', 'roster')] });
  } catch {
    return false;
  }
}

function downloadRos(xml: string, faction: string): void {
  const filename = `${faction}.ros`;
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportModal({
  forces,
  allegiance,
  pointsLimit,
  totalPoints,
  onClose,
}: ExportModalProps) {
  const cohortDoctrine = useRosterStore((s) => s.cohortDoctrine);
  const armyChoices = useRosterStore((s) => s.armyChoices);
  const configChoices = useRosterStore((s) => s.configChoices);
  const text = useMemo(
    () => buildExportText(withEffectiveSlots(forces), allegiance, pointsLimit, totalPoints),
    [forces, allegiance, pointsLimit, totalPoints]
  );

  const [copied, setCopied] = useState(false);
  // Only touch devices: desktop browsers that can share files still expect a download
  const share = useMemo(() => window.matchMedia('(pointer: coarse)').matches && canShareFiles(), []);

  function copyToClipboard() {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  const rosXml = () => buildRosXml(forces, pointsLimit, totalPoints, { allegiance, cohortDoctrine, armyChoices, configChoices });
  const faction = forces.find((f) => f.kind === 'primary')?.faction ?? 'roster';

  function handleDownloadRos() {
    downloadRos(rosXml(), faction);
  }

  function handleShareRos() {
    navigator.share({ files: [rosFile(rosXml(), faction)], title: `${factionLabel(faction)} roster` }).catch((err) => {
      // Dismissing the sheet is an AbortError; anything else falls back to a download
      if ((err as DOMException)?.name !== 'AbortError') handleDownloadRos();
    });
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
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          Close
        </Button>
        <Button kind="secondary" onClick={copyToClipboard}>
          {copied ? 'Copied' : 'Copy text'}
        </Button>
        {share ? (
          <Button kind="primary" onClick={handleShareRos}>
            Share .ros
          </Button>
        ) : (
          <Button kind="primary" onClick={handleDownloadRos}>
            Download .ros
          </Button>
        )}
      </ModalFooter>
    </ComposedModal>
  );
}
