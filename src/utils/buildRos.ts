/**
 * buildRos.ts
 * Generates a BattleScribe/New Recruit compatible .ros XML string from the
 * current roster state. Produces one <force> per placed detachment, with
 * one <selection> per filled slot (including bonus slots).
 */

import type { PlacedDetachment } from '../types';
import { systemData, cataloguesData } from '../data/loader';
import { expandSlots } from '../components/canvas/DetachmentCard';
import { FACTION_LABEL_MAP } from '../data/factions';

// Points cost typeId — consistent across all HH3 BSData files
const POINTS_TYPE_ID = '9893-c379-920b-8982';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function uuid(): string {
  return crypto.randomUUID();
}

export function buildRosXml(
  detachments: PlacedDetachment[],
  faction: string,
  pointsLimit: number,
  totalPoints: number
): string {
  const { gameSystemId, gameSystemName, revision: gameSystemRevision, forceOrgEntryId } = systemData;
  const cat = cataloguesData[faction];
  const catalogueId = cat?.catalogueId ?? '';
  const catalogueName = cat?.catalogueName ?? (FACTION_LABEL_MAP[faction] ?? faction);
  const catalogueRevision = cat?.revision ?? 0;
  const rosterName = escapeXml(FACTION_LABEL_MAP[faction] ?? catalogueName);

  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push(
    `<roster xmlns="http://www.battlescribe.net/schema/rosterSchema"` +
    ` id="${uuid()}"` +
    ` name="${rosterName}"` +
    ` battleScribeVersion="2.03"` +
    ` gameSystemId="${escapeXml(gameSystemId)}"` +
    ` gameSystemName="${escapeXml(gameSystemName)}"` +
    ` gameSystemRevision="${gameSystemRevision}"` +
    ` points="${totalPoints}"` +
    ` pointsLimit="${pointsLimit}">`
  );

  // Roster-level costs
  lines.push('  <costs>');
  lines.push(
    `    <cost name="pts" value="${totalPoints}" costTypeId="${POINTS_TYPE_ID}"/>`
  );
  lines.push('  </costs>');

  // All detachment forces are nested inside the "Crusade Force Organization Chart"
  // parent force, which is the top-level forceEntry in the game system.
  lines.push('  <forces>');
  lines.push(
    `    <force` +
    ` id="${uuid()}"` +
    ` name="Crusade Force Organization Chart"` +
    ` entryId="${escapeXml(forceOrgEntryId)}"` +
    ` catalogueId="${escapeXml(catalogueId)}"` +
    ` catalogueName="${escapeXml(catalogueName)}"` +
    ` catalogueRevision="${catalogueRevision}">`
  );
  lines.push('      <forces>');

  for (const det of detachments) {
    const forceEntryId = det.def.entryId ?? '';
    const detName = escapeXml(det.def.name);

    lines.push(
      `        <force` +
      ` id="${uuid()}"` +
      ` name="${detName}"` +
      ` entryId="${escapeXml(forceEntryId)}"` +
      ` catalogueId="${escapeXml(catalogueId)}"` +
      ` catalogueName="${escapeXml(catalogueName)}"` +
      ` catalogueRevision="${catalogueRevision}">`
    );
    lines.push('          <selections>');

    // Regular slots
    const expanded = expandSlots(det.def);
    for (const { key } of expanded) {
      const filled = det.slots[key];
      if (!filled) continue;
      const { unit } = filled;
      lines.push(
        `            <selection` +
        ` id="${uuid()}"` +
        ` name="${escapeXml(unit.name)}"` +
        ` entryId="${escapeXml(unit.entryId ?? '')}"` +
        ` number="1"` +
        ` type="unit">`
      );
      lines.push('              <costs>');
      lines.push(
        `                <cost name="pts" value="${unit.points}" costTypeId="${POINTS_TYPE_ID}"/>`
      );
      lines.push('              </costs>');
      lines.push('            </selection>');
    }

    // Bonus slots (Logistical Benefit)
    for (const bs of det.bonusSlots ?? []) {
      if (!bs.unit) continue;
      lines.push(
        `            <selection` +
        ` id="${uuid()}"` +
        ` name="${escapeXml(bs.unit.name)}"` +
        ` entryId="${escapeXml(bs.unit.entryId ?? '')}"` +
        ` number="1"` +
        ` type="unit">`
      );
      lines.push('              <costs>');
      lines.push(
        `                <cost name="pts" value="${bs.unit.points}" costTypeId="${POINTS_TYPE_ID}"/>`
      );
      lines.push('              </costs>');
      lines.push('            </selection>');
    }

    lines.push('          </selections>');
    lines.push('        </force>');
  }

  lines.push('      </forces>');
  lines.push('    </force>');
  lines.push('  </forces>');
  lines.push('</roster>');

  return lines.join('\n');
}
