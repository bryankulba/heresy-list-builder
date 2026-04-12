/**
 * buildRos.ts
 * Generates a BattleScribe/New Recruit compatible .ros XML string from the
 * current roster state. Produces one <force> per placed detachment, with
 * one <selection> per filled slot (including bonus slots).
 */

import type { PlacedDetachment, UnitEntry } from '../types';
import { systemData, cataloguesData } from '../data/loader';

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

/**
 * Emits lines for a single unit <selection>, including nested model child
 * selections and the slot category. Callers provide the indent prefix.
 */
function emitUnitSelection(
  lines: string[],
  unit: UnitEntry,
  categoryId: string | undefined,
  categoryRole: string,
  indent: string
): void {
  const i = indent;
  lines.push(
    `${i}<selection` +
    ` id="${uuid()}"` +
    ` name="${escapeXml(unit.name)}"` +
    ` entryId="${escapeXml(unit.entryId ?? '')}"` +
    ` number="1"` +
    ` type="unit">`
  );

  // Child model selections — only if models are present
  if (unit.models && unit.models.length > 0) {
    lines.push(`${i}  <selections>`);
    for (const model of unit.models) {
      const modelCost = Math.round(model.cost * model.min);
      lines.push(
        `${i}    <selection` +
        ` id="${uuid()}"` +
        ` name="${escapeXml(model.name)}"` +
        ` entryId="${escapeXml(model.entryId ?? '')}"` +
        ` number="${model.min}"` +
        ` type="model">`
      );
      // Default wargear as nested upgrade selections
      if (model.defaultWargear && model.defaultWargear.length > 0) {
        lines.push(`${i}      <selections>`);
        for (const wg of model.defaultWargear) {
          lines.push(
            `${i}        <selection` +
            ` id="${uuid()}"` +
            ` name="${escapeXml(wg.name)}"` +
            ` entryId="${escapeXml(wg.entryId)}"` +
            ` number="${model.min}"` +
            ` type="upgrade">`
          );
          lines.push(`${i}          <costs>`);
          lines.push(`${i}            <cost name="pts" value="0" costTypeId="${POINTS_TYPE_ID}"/>`);
          lines.push(`${i}          </costs>`);
          lines.push(`${i}        </selection>`);
        }
        lines.push(`${i}      </selections>`);
      }
      lines.push(`${i}      <costs>`);
      lines.push(`${i}        <cost name="pts" value="${modelCost}" costTypeId="${POINTS_TYPE_ID}"/>`);
      lines.push(`${i}      </costs>`);
      lines.push(`${i}    </selection>`);
    }
    lines.push(`${i}  </selections>`);
  }

  // Slot category (tells NR which detachment slot this unit occupies)
  if (categoryId) {
    lines.push(`${i}  <categories>`);
    lines.push(
      `${i}    <category id="${uuid()}" name="${escapeXml(categoryRole)}" primary="true" entryId="${escapeXml(categoryId)}"/>`
    );
    lines.push(`${i}  </categories>`);
  }

  lines.push(`${i}  <costs>`);
  lines.push(`${i}    <cost name="pts" value="${unit.points}" costTypeId="${POINTS_TYPE_ID}"/>`);
  lines.push(`${i}  </costs>`);
  lines.push(`${i}</selection>`);
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

  lines.push('  <costs>');
  lines.push(`    <cost name="pts" value="${totalPoints}" costTypeId="${POINTS_TYPE_ID}"/>`);
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

    // All regular + prime slots — iterate directly to capture Apex prime-only slots
    for (const [key, filled] of Object.entries(det.slots)) {
      if (!filled) continue;
      const role = key.slice(0, key.lastIndexOf('-'));
      const slotDef = det.def.slots.find(s => s.role === role);
      emitUnitSelection(lines, filled.unit, slotDef?.categoryId, role, '            ');
    }

    // Bonus slots (Logistical Benefit)
    for (const bs of det.bonusSlots ?? []) {
      if (!bs.unit) continue;
      const bonusSlotDef = det.def.slots.find(s => s.role === bs.role);
      emitUnitSelection(lines, bs.unit, bonusSlotDef?.categoryId, bs.role, '            ');
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
