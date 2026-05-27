/**
 * buildRos.ts
 * Generates a BattleScribe/New Recruit compatible .ros XML string from the
 * current roster state. Produces one <force> per placed detachment, with
 * one <selection> per filled slot (including bonus slots).
 */

import type { PlacedDetachment, UnitEntry } from '../types';
import { systemData, cataloguesData, detachmentsData } from '../data/loader';

import { FACTION_LABEL_MAP } from '../data/factions';

// Points cost typeId — consistent across all HH3 BSData files
const POINTS_TYPE_ID = '9893-c379-920b-8982';

// BSData IDs for "LB - [Role]" upgrade selections inside "Common Prime Benefits"
const LB_ROLE_IDS: Record<string, string> = {
  'Armour':         'd5b0-22dc-909e-415e',
  'Retinue':        'e788-1cee-dabe-1e19',
  'Elites':         'd81c-494b-0302-5844',
  'Support':        '18ed-afc2-ec5d-9f8c',
  'Recon':          'a166-27df-d75c-bdb0',
  'Transport':      '861f-723a-938e-bc2c',
  'Troops':         '9e8c-63b6-a15a-cd4f',
  'War-engine':     'fac3-0af2-8be3-20dc',
  'Heavy Transport':'ad55-0e60-66fe-a7a9',
  'Fast Attack':    'cf0d-0aff-8242-f25a',
  'Heavy Assault':  '5da8-2289-4e20-649f',
};

// Global role→categoryId fallback for bonus slots whose role may not exist in the
// detachment's own slot list (e.g. "Support" bonus from Logistical Benefit in CPD).
const ROLE_CATEGORY_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const allDets = [
    ...detachmentsData.core,
    ...detachmentsData.auxiliary,
    ...detachmentsData.apex,
    ...Object.values(detachmentsData.legion ?? {}).flat(),
  ];
  for (const det of allDets) {
    for (const slot of det.slots) {
      if (slot.categoryId && !(slot.role in map)) {
        map[slot.role] = slot.categoryId;
      }
    }
  }
  return map;
})();

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
  indent: string,
  extraSelections?: Array<{ name: string; entryId: string }>
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

  // Child model selections, unit-level wargear, and prime benefit upgrade(s)
  const hasModels = unit.models && unit.models.length > 0;
  const hasUnitWargear = unit.unitWargear && unit.unitWargear.length > 0;
  const hasExtras = extraSelections && extraSelections.length > 0;
  if (hasModels || hasUnitWargear || hasExtras) {
    lines.push(`${i}  <selections>`);
    for (const model of (unit.models ?? [])) {
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
    // Unit-level mandatory wargear (grenades, boarding shields, etc.)
    for (const uw of (unit.unitWargear ?? [])) {
      lines.push(
        `${i}    <selection` +
        ` id="${uuid()}"` +
        ` name="${escapeXml(uw.name)}"` +
        ` entryId="${escapeXml(uw.entryId)}"` +
        ` number="1"` +
        ` type="upgrade">`
      );
      lines.push(`${i}      <costs>`);
      lines.push(`${i}        <cost name="pts" value="0" costTypeId="${POINTS_TYPE_ID}"/>`);
      lines.push(`${i}      </costs>`);
      lines.push(`${i}    </selection>`);
    }
    for (const extra of (extraSelections ?? [])) {
      lines.push(
        `${i}    <selection` +
        ` id="${uuid()}"` +
        ` name="${escapeXml(extra.name)}"` +
        ` entryId="${escapeXml(extra.entryId)}"` +
        ` number="1"` +
        ` type="upgrade">`
      );
      lines.push(`${i}      <costs>`);
      lines.push(`${i}        <cost name="pts" value="0" costTypeId="${POINTS_TYPE_ID}"/>`);
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

      const extras: Array<{ name: string; entryId: string }> = [];

      // Logistical Benefit: emit LB - [Role] upgrade so BSData conditions fire
      const bonusSlot = det.bonusSlots?.find(bs => bs.sourceSlotKey === key);
      if (bonusSlot) {
        const lbId = LB_ROLE_IDS[bonusSlot.role];
        if (lbId) extras.push({ name: `LB - ${bonusSlot.role}`, entryId: lbId });
      }

      // High Command / Command prime: emit One Apex/Auxiliary Detachment upgrade
      // for each detachment this slot unlocked (Officer of the Line can unlock two)
      const unlockedDets = detachments.filter(d => d.unlockedBy === `${det.id}::${key}`);
      for (const ud of unlockedDets) {
        const isApex = detachmentsData.apex.some(a => a.entryId === ud.def.entryId);
        extras.push({
          name: isApex ? 'One Apex Detachment' : 'One Auxiliary Detachment',
          entryId: isApex ? '0889-888b-e3fe-1d5b' : '4ad5-105a-9b10-57dd',
        });
      }

      emitUnitSelection(lines, filled.unit, slotDef?.categoryId, role, '            ', extras.length ? extras : undefined);
    }

    // Bonus slots (Logistical Benefit)
    for (const bs of det.bonusSlots ?? []) {
      if (!bs.unit) continue;
      const bonusSlotDef = det.def.slots.find(s => s.role === bs.role);
      const bonusCategoryId = bonusSlotDef?.categoryId ?? ROLE_CATEGORY_MAP[bs.role];
      emitUnitSelection(lines, bs.unit, bonusCategoryId, bs.role, '            ');
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
