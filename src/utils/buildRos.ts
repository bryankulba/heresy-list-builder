/**
 * buildRos.ts
 * Generates a BattleScribe/New Recruit compatible .ros XML string from the
 * current roster state. Produces one root <force> per army (primary and
 * allied) carrying its army configuration (Allegiance, Rite of War…), one
 * child <force> per placed detachment, and one <selection> per filled slot.
 *
 * Selection entryIds are the "::"-joined paths New Recruit writes (computed by
 * the parser — see scripts/parse-bsdata.ts), so rosters open in New Recruit
 * with the same entries a list built there would have.
 */

import type { Allegiance, Force, ModelEntry, UnitEntry, WargearEntry } from '../types';
import { systemData, cataloguesData, detachmentsData, getBaseRole, getChart, rulesData, type ArmyConfigEntry } from '../data/loader';
import { FACTION_BY_ID, factionLabel } from '../data/factions';
import { COHORT_DOCTRINE_BY_ID } from '../constants/cohortDoctrines';
import { findPrimeNodeInGroups, logisticalBenefitChoice } from '../rules/primeBenefits';
import { effectivePrimaryCategory, withEffectiveSlots } from '../rules/slots';
import { rosterCounts, unitContext } from '../rules/context';
import { effectiveHidden, type RuleContext } from '../rules/evaluate';
import { cardSlots } from '../components/canvas/slotLayout';
import { applyArmyChoice, type ArmyChoices } from '../rules/armyChoices';

// Points cost type — consistent across all HH3 BSData files
const POINTS_TYPE_ID = '9893-c379-920b-8982';
const POINTS_NAME = 'Point(s)';

export interface RosOptions {
  allegiance: Allegiance;
  /** Cohort doctrine id (Solar Auxilia primary army) */
  cohortDoctrine?: string;
  /** Army-wide picks for per-unit choices (sub-faction) — see rules/armyChoices.ts */
  armyChoices?: ArmyChoices;
}

/** A selection to emit. */
interface Sel {
  name: string;
  entryId: string;
  entryGroupId?: string;
  type: 'unit' | 'model' | 'upgrade' | 'unit-group';
  number: number;
  cost?: number;
  categories?: Array<{ name: string; entryId: string; primary: boolean }>;
  children?: Sel[];
}

// Global role→categoryId fallback for bonus slots whose role may not exist in the
// detachment's own slot list (e.g. "Support" bonus from Logistical Benefit in CPD).
const ROLE_CATEGORY_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const det of detachmentsData.charts.flatMap((c) => c.detachments)) {
    for (const slot of det.slots) {
      if (slot.categoryId && !(slot.role in map)) map[slot.role] = slot.categoryId;
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

function costXml(value: number, i: string): string[] {
  return [`${i}<costs>`, `${i}  <cost name="${POINTS_NAME}" typeId="${POINTS_TYPE_ID}" value="${value}"/>`, `${i}</costs>`];
}

function emitSelection(lines: string[], sel: Sel, i: string): void {
  const group = sel.entryGroupId ? ` entryGroupId="${escapeXml(sel.entryGroupId)}"` : '';
  lines.push(
    `${i}<selection id="${uuid()}" name="${escapeXml(sel.name)}" entryId="${escapeXml(sel.entryId)}"${group}` +
      ` number="${sel.number}" type="${sel.type}" from="${sel.entryGroupId ? 'group' : 'entry'}">`
  );
  if (sel.children && sel.children.length > 0) {
    lines.push(`${i}  <selections>`);
    for (const child of sel.children) emitSelection(lines, child, `${i}    `);
    lines.push(`${i}  </selections>`);
  }
  if (sel.categories && sel.categories.length > 0) {
    lines.push(`${i}  <categories>`);
    for (const c of sel.categories) {
      lines.push(
        `${i}    <category id="${uuid()}" name="${escapeXml(c.name)}" entryId="${escapeXml(c.entryId)}" primary="${c.primary}"/>`
      );
    }
    lines.push(`${i}  </categories>`);
  }
  lines.push(...costXml(sel.cost ?? 0, `${i}  `));
  lines.push(`${i}</selection>`);
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

function wargearSel(entry: WargearEntry, number: number, choices?: ArmyChoices): Sel {
  const w = applyArmyChoice(entry, choices);
  return {
    name: w.name,
    entryId: w.path ?? w.entryId,
    ...(w.groupPath ? { entryGroupId: w.groupPath } : {}),
    type: 'upgrade',
    number: number * (w.count ?? 1),
    children: (w.children ?? []).map((c) => wargearSel(c, number * (w.count ?? 1), choices)),
  };
}

function modelSel(m: ModelEntry, choices?: ArmyChoices): Sel {
  return {
    name: m.name,
    entryId: m.path ?? m.entryId ?? '',
    type: m.kind === 'unit' ? 'unit-group' : 'model',
    number: m.min,
    cost: Math.round(m.cost * m.min),
    children: [
      ...(m.models ?? []).map((sub) => modelSel(sub, choices)),
      ...m.defaultWargear.map((w) => wargearSel(w, m.min, choices)),
    ],
  };
}

/** A unit's primary category, as New Recruit records it. */
function primaryCategory(role: string, categoryId: string | undefined): Sel['categories'] {
  return categoryId ? [{ name: role, entryId: categoryId, primary: true }] : undefined;
}

function unitSel(
  unit: UnitEntry,
  categories: Sel['categories'],
  extraPoints: number,
  extras: Sel[],
  choices?: ArmyChoices
): Sel {
  return {
    name: unit.name,
    entryId: unit.path ?? unit.entryId ?? '',
    type: 'unit',
    number: 1,
    // Models carry their own costs; the unit carries its base cost (+ any extra points noted)
    cost: unit.baseCost + extraPoints,
    categories,
    children: [
      ...unit.models.map((m) => modelSel(m, choices)),
      ...(unit.unitWargear ?? []).map((w) => wargearSel(w, 1, choices)),
      ...extras,
    ],
  };
}

// ---------------------------------------------------------------------------
// Army configuration (root force selections)
// ---------------------------------------------------------------------------

function armyConfigFor(force: Force): ArmyConfigEntry[] {
  const keys = ['game-system', ...(FACTION_BY_ID[force.faction]?.unitSources ?? [force.faction])];
  const seen = new Set<string>();
  return keys
    .flatMap((k) => rulesData.armyConfig[k] ?? [])
    .filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)));
}

function configSel(entry: ArmyConfigEntry, choiceName: string | undefined): Sel {
  const choice = choiceName ? entry.choices.find((c) => c.name === choiceName) : undefined;
  const children = choice
    ? [{ name: choice.name, entryId: choice.path, entryGroupId: choice.groupPath, type: 'upgrade' as const, number: 1 }]
    : entry.defaults.map((w) => wargearSel(w, 1));
  return {
    name: entry.name,
    entryId: entry.path,
    type: 'upgrade',
    number: 1,
    // Root selections need their primary category for New Recruit to count them
    ...(entry.categoryId ? { categories: [{ name: entry.category, entryId: entry.categoryId, primary: true }] } : {}),
    children,
  };
}

/**
 * Required, visible army configuration for a root force: Allegiance (from the
 * roster) and the cohort doctrine are chosen; everything else gets its BSData
 * defaults — remaining choices are finished in New Recruit.
 */
function armyConfigSelections(force: Force, ctx: RuleContext, opts: RosOptions): Sel[] {
  const doctrine = opts.cohortDoctrine ? COHORT_DOCTRINE_BY_ID[opts.cohortDoctrine]?.name : undefined;
  return armyConfigFor(force)
    .filter((e) => e.min >= 1 && !effectiveHidden(e.hidden ?? false, e.modifiers, ctx))
    .filter((e) => force.kind === 'primary' || e.category !== 'Allegiance')
    .map((e) => {
      if (e.category === 'Allegiance') return configSel(e, opts.allegiance);
      if (e.name === 'Cohort Doctrine' && doctrine) return configSel(e, `Cohort Doctrine: ${doctrine}`);
      return configSel(e, undefined);
    });
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export function buildRosXml(forces: Force[], pointsLimit: number, totalPoints: number, opts: RosOptions): string {
  const { gameSystemId, gameSystemName, revision: gameSystemRevision } = systemData;
  const primary = forces.find((f) => f.kind === 'primary') ?? forces[0];
  const rosterName = escapeXml(primary ? factionLabel(primary.faction) : gameSystemName);
  const detachments = forces.flatMap((f) => f.detachments);
  const counts = rosterCounts(forces);

  // Slot roles as the canvas shows them (slot counts evaluated from the
  // detachment's contents), so a unit in a position a rule made Prime exports
  // as Prime
  const view = withEffectiveSlots(forces);
  const slotDefsByDetachment = new Map(
    view.flatMap((f) => f.detachments).map((det) => [det.id, new Map(cardSlots(det).map((s) => [s.key, s.slotDef]))])
  );

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push(
    `<roster xmlns="http://www.battlescribe.net/schema/rosterSchema"` +
      ` id="${uuid()}"` +
      ` name="${rosterName}"` +
      ` battleScribeVersion="2.03"` +
      ` gameSystemId="${escapeXml(gameSystemId)}"` +
      ` gameSystemName="${escapeXml(gameSystemName)}"` +
      ` gameSystemRevision="${gameSystemRevision}">`
  );
  lines.push(...costXml(totalPoints, '  '));
  lines.push('  <costLimits>');
  lines.push(`    <costLimit name="${POINTS_NAME}" typeId="${POINTS_TYPE_ID}" value="${pointsLimit}"/>`);
  lines.push('  </costLimits>');

  // Each army is a root force for its force org chart (Crusade, Allied
  // Detachment, Knight Households…), with one child force per detachment.
  lines.push('  <forces>');
  for (const force of forces) {
    const chart = getChart(force.chart);
    const cat = cataloguesData[force.faction];
    const catalogueAttrs =
      ` catalogueId="${escapeXml(cat?.catalogueId ?? '')}"` +
      ` catalogueName="${escapeXml(cat?.catalogueName ?? factionLabel(force.faction))}"` +
      ` catalogueRevision="${cat?.revision ?? 0}"`;
    const rootCtx: RuleContext = {
      catalogueId: cat?.catalogueId ?? '',
      forceEntryIds: [chart.id],
      unit: {},
      force: {},
      roster: counts.roster,
      rosterForces: counts.rosterForces,
      level: 'detachment',
    };

    lines.push(
      `    <force id="${uuid()}" name="${escapeXml(chart.name)}" entryId="${escapeXml(chart.id)}"${catalogueAttrs}>`
    );
    const config = armyConfigSelections(force, rootCtx, opts);
    if (config.length > 0) {
      lines.push('      <selections>');
      for (const sel of config) emitSelection(lines, sel, '        ');
      lines.push('      </selections>');
    }
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
        const unit = filled.unit;
        // A unit in a Prime position keeps its own primary category (e.g.
        // "Troops - Terror Squads Only"); the Prime category goes on its
        // "Prime Unit" upgrade — as New Recruit records it
        const baseRole = role.replace(/^Prime /, '');
        const ownCategory = effectivePrimaryCategory(unit, unitContext(forces, force, det, unit, categoryId, counts));
        const unitRole = baseRole !== role && getBaseRole(ownCategory) === getBaseRole(baseRole) ? ownCategory : baseRole;
        const unitCategoryId = unitRole === role ? categoryId : ROLE_CATEGORY_MAP[unitRole];
        const extras: Sel[] = [];

        // Prime unit: emit its "Prime Unit" upgrade with the chosen benefit inside
        // it (and, for Logistical Benefit, the "LB - <role>" choice) so BSData's
        // prime categories and conditions fire
        const isPrime = filled.isPrime ?? slotDef?.prime ?? role.startsWith('Prime ');
        if (isPrime && unit.prime) {
          const benefit = filled.primeBenefit;
          const found = benefit ? findPrimeNodeInGroups(unit, benefit) : undefined;
          const bonusSlot = det.bonusSlots?.find((bs) => bs.sourceSlotKey === key);
          const lbChoice = benefit && bonusSlot ? logisticalBenefitChoice(unit, benefit, bonusSlot.role) : undefined;
          const at = (rel: string | undefined) => (found && rel ? `${found.prefix}::${rel}` : undefined);
          extras.push({
            name: 'Prime Unit',
            entryId: unit.prime.path ?? unit.prime.linkId,
            type: 'upgrade',
            number: 1,
            ...(role !== unitRole && categoryId ? { categories: [{ name: role, entryId: categoryId, primary: false }] } : {}),
            children: found
              ? [{
                  name: found.node.name,
                  entryId: at(found.node.path) ?? found.node.id,
                  entryGroupId: at(found.node.groupPath),
                  type: 'upgrade',
                  number: 1,
                  children: lbChoice
                    ? [{
                        name: lbChoice.name,
                        entryId: at(lbChoice.path) ?? lbChoice.id,
                        entryGroupId: at(lbChoice.groupPath),
                        type: 'upgrade',
                        number: 1,
                      }]
                    : [],
                }]
              : [],
          });
        }

        // High Command: record which kind of detachment each unlock was
        // ("One Apex / One Auxiliary Detachment"), where the unit offers that choice
        if (unit.detachmentChoice) {
          const { prefix, groupId } = unit.detachmentChoice;
          // From the detachments this slot unlocked; marks carried over from an
          // imported roster are kept only while nothing is linked to it
          const unlocked = detachments
            .filter((d) => d.unlockedBy === `${det.id}::${key}`)
            .map((d) => (d.def.type === 'apex' ? ('apex' as const) : ('auxiliary' as const)));
          const kinds = unlocked.length > 0 ? unlocked : filled.detachmentChoices ?? [];
          for (const kind of kinds) {
            const choice = kind === 'apex' ? rulesData.detachmentChoice.apex : rulesData.detachmentChoice.auxiliary;
            if (!choice) continue;
            extras.push({
              name: choice.name,
              entryId: `${prefix}::${choice.id}`,
              entryGroupId: `${prefix}::${groupId}`,
              type: 'upgrade',
              number: 1,
            });
          }
        }

        emitSelection(lines, unitSel(unit, primaryCategory(unitRole, unitCategoryId), filled.extraPoints ?? 0, extras, opts.armyChoices), '            ');
      }

      // Bonus slots (Logistical Benefit)
      for (const bs of det.bonusSlots ?? []) {
        if (!bs.unit) continue;
        const bonusSlotDef = det.def.slots.find((s) => s.role === bs.role);
        const categoryId = bonusSlotDef?.categoryId ?? ROLE_CATEGORY_MAP[bs.role];
        emitSelection(lines, unitSel(bs.unit, primaryCategory(bs.role, categoryId), bs.extraPoints ?? 0, [], opts.armyChoices), '            ');
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
