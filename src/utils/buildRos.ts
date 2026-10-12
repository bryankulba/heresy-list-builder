/**
 * buildRos.ts
 * Generates a BattleScribe/New Recruit compatible .ros XML string from the
 * current roster state. Produces one root <force> per army (primary and
 * allied), one child <force> per placed detachment, and one <selection> per
 * filled slot (including bonus slots).
 */

import type { Force, UnitEntry } from '../types';
import { systemData, cataloguesData, detachmentsData, getChart, rulesData } from '../data/loader';
import { factionLabel } from '../data/factions';
import { findPrimeNode, logisticalBenefitChoice } from '../rules/primeBenefits';
import { withEffectiveSlots } from '../rules/slots';
import { cardSlots } from '../components/canvas/slotLayout';

// Points cost typeId — consistent across all HH3 BSData files
const POINTS_TYPE_ID = '9893-c379-920b-8982';

/** A nested upgrade selection to emit inside a unit (e.g. Prime Unit → benefit → LB - Role). */
interface ExtraSelection {
  name: string;
  entryId: string;
  children?: ExtraSelection[];
}

// Global role→categoryId fallback for bonus slots whose role may not exist in the
// detachment's own slot list (e.g. "Support" bonus from Logistical Benefit in CPD).
const ROLE_CATEGORY_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const allDets = detachmentsData.charts.flatMap((c) => c.detachments);
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

function emitExtraSelection(lines: string[], extra: ExtraSelection, i: string): void {
  lines.push(
    `${i}<selection id="${uuid()}" name="${escapeXml(extra.name)}" entryId="${escapeXml(extra.entryId)}" number="1" type="upgrade">`
  );
  if (extra.children && extra.children.length > 0) {
    lines.push(`${i}  <selections>`);
    for (const child of extra.children) emitExtraSelection(lines, child, `${i}    `);
    lines.push(`${i}  </selections>`);
  }
  lines.push(`${i}  <costs>`);
  lines.push(`${i}    <cost name="pts" value="0" costTypeId="${POINTS_TYPE_ID}"/>`);
  lines.push(`${i}  </costs>`);
  lines.push(`${i}</selection>`);
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
  extraSelections?: ExtraSelection[]
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
    for (const extra of (extraSelections ?? [])) emitExtraSelection(lines, extra, `${i}    `);
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

export function buildRosXml(forces: Force[], pointsLimit: number, totalPoints: number): string {
  const { gameSystemId, gameSystemName, revision: gameSystemRevision } = systemData;
  const primary = forces.find((f) => f.kind === 'primary') ?? forces[0];
  const rosterName = escapeXml(primary ? factionLabel(primary.faction) : gameSystemName);
  const detachments = forces.flatMap((f) => f.detachments);

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

  // Each army is a root force for its force org chart (Crusade, Allied
  // Detachment, Knight Households…), with one child force per detachment.
  // Slot roles as the canvas shows them (slot counts evaluated from the
  // detachment's contents), so a unit in a position a rule made Prime exports
  // as Prime
  const view = withEffectiveSlots(forces);
  const slotDefsByDetachment = new Map(
    view.flatMap((f) => f.detachments).map((det) => [det.id, new Map(cardSlots(det).map((s) => [s.key, s.slotDef]))])
  );

  lines.push('  <forces>');
  for (const force of forces) {
    const chart = getChart(force.chart);
    const cat = cataloguesData[force.faction];
    const catalogueAttrs =
      ` catalogueId="${escapeXml(cat?.catalogueId ?? '')}"` +
      ` catalogueName="${escapeXml(cat?.catalogueName ?? factionLabel(force.faction))}"` +
      ` catalogueRevision="${cat?.revision ?? 0}"`;

    lines.push(
      `    <force id="${uuid()}" name="${escapeXml(chart.name)}" entryId="${escapeXml(chart.id)}"${catalogueAttrs}>`
    );
    lines.push('      <forces>');

    for (const det of force.detachments) {
      lines.push(
        `        <force id="${uuid()}" name="${escapeXml(det.def.name)}" entryId="${escapeXml(det.def.entryId ?? '')}"${catalogueAttrs}>`
      );
      lines.push('          <selections>');

      // All regular + prime slots — iterate directly to capture Apex prime-only slots
      for (const [key, filled] of Object.entries(det.slots)) {
        if (!filled) continue;
        const slotDef = slotDefsByDetachment.get(det.id)?.get(key);
        const role = slotDef?.role ?? key.slice(0, key.lastIndexOf('-'));
        const categoryId = slotDef?.categoryId ?? ROLE_CATEGORY_MAP[role];

        const extras: ExtraSelection[] = [];

        // Prime slot: emit the unit's "Prime Unit" upgrade with the chosen benefit
        // inside it (and, for Logistical Benefit, the "LB - <role>" choice) so
        // BSData's prime categories and conditions fire
        if ((slotDef?.prime ?? role.startsWith('Prime ')) && filled.unit.prime) {
          const benefit = filled.primeBenefit;
          const benefitNode = benefit ? findPrimeNode(filled.unit, benefit) : undefined;
          const bonusSlot = det.bonusSlots?.find(bs => bs.sourceSlotKey === key);
          const lbChoice = benefit && bonusSlot ? logisticalBenefitChoice(filled.unit, benefit, bonusSlot.role) : undefined;
          extras.push({
            name: 'Prime Unit',
            entryId: filled.unit.prime.linkId,
            children: benefitNode
              ? [{
                  name: benefitNode.name,
                  entryId: benefitNode.id,
                  children: lbChoice ? [{ name: lbChoice.name, entryId: lbChoice.id }] : undefined,
                }]
              : undefined,
          });
        }

        // High Command / Command prime: emit One Apex/Auxiliary Detachment upgrade
        // for each detachment this slot unlocked (Officer of the Line can unlock two)
        const unlockedDets = detachments.filter(d => d.unlockedBy === `${det.id}::${key}`);
        for (const ud of unlockedDets) {
          const choice = ud.def.type === 'apex' ? rulesData.detachmentChoice.apex : rulesData.detachmentChoice.auxiliary;
          if (choice) extras.push({ name: choice.name, entryId: choice.id });
        }

        emitUnitSelection(lines, filled.unit, categoryId, role, '            ', extras.length ? extras : undefined);
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
  }
  lines.push('  </forces>');
  lines.push('</roster>');

  return lines.join('\n');
}
