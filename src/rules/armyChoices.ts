/**
 * armyChoices.ts
 * Choices BSData asks for on every unit but that are really made once for the
 * army — a Skitarii or Mechanicum unit's sub-faction. The roster keeps one pick
 * per choice group (`armyChoices`: group id → option id) and the export applies
 * it to every unit carrying that group.
 */

import type { PlacedDetachment, UnitEntry, WargearEntry } from '../types';
import { cataloguesData, factionUnitsLoaded, getUnitsForFaction, rulesData, type ArmyChoiceGroup } from '../data/loader';
import { effectiveHidden, type RuleContext } from './evaluate';

export type ArmyChoices = Record<string, string>;

const groupOf = (w: WargearEntry) => w.groupPath?.split('::').pop();

/** Choice groups the units carry, most widely used first (a Skitarii army's own sub-faction before Mechanicum's). */
function choiceGroupIds(units: UnitEntry[]): string[] {
  const counts = new Map<string, number>();
  const visit = (ws: WargearEntry[] | undefined) => {
    for (const w of ws ?? []) {
      const g = groupOf(w);
      if (g && rulesData.armyChoices[g]) counts.set(g, (counts.get(g) ?? 0) + 1);
      visit(w.children);
    }
  };
  for (const u of units) {
    visit(u.unitWargear);
    for (const m of u.models) visit(m.defaultWargear);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

const cache = new Map<string, Array<{ id: string } & ArmyChoiceGroup>>();

/**
 * The army-wide choices an army of `faction` makes, with the options visible
 * to it — its own catalogue's only (a Solar Auxilia Tech-Priest's Mechanicum
 * sub-faction keeps BSData's default rather than adding a choice).
 */
export function armyChoiceGroups(faction: string): Array<{ id: string } & ArmyChoiceGroup> {
  const cached = cache.get(faction);
  if (cached) return cached;
  const ctx: RuleContext = {
    catalogueId: cataloguesData[faction]?.catalogueId ?? '',
    forceEntryIds: [],
    unit: {},
    force: {},
    roster: {},
    rosterForces: {},
  };
  const groups = choiceGroupIds(getUnitsForFaction(faction))
    .filter((id) => !rulesData.armyChoices[id].catalogue || rulesData.armyChoices[id].catalogue === faction)
    .map((id) => {
    const g = rulesData.armyChoices[id];
    return { id, ...g, options: g.options.filter((o) => !effectiveHidden(o.hidden ?? false, o.modifiers, ctx)) };
  });
  if (factionUnitsLoaded(faction)) cache.set(faction, groups);
  return groups;
}

/** A wargear entry with the army's pick applied, if it comes from an army-wide choice group. */
export function applyArmyChoice(w: WargearEntry, choices: ArmyChoices | undefined): WargearEntry {
  const groupId = groupOf(w);
  const optionId = groupId ? choices?.[groupId] : undefined;
  const option = optionId ? rulesData.armyChoices[groupId!]?.options.find((o) => o.id === optionId) : undefined;
  if (!option || !w.groupPath || option.id === w.entryId) return w;
  const prefix = w.groupPath.split('::').slice(0, -1);
  return { name: option.name, entryId: option.id, path: [...prefix, option.path].join('::'), groupPath: w.groupPath };
}

/** Label for a choice group ("Skitarii Sub Factions" → "Skitarii sub-faction"). */
export function armyChoiceLabel(group: ArmyChoiceGroup): string {
  const m = group.name.match(/^(.*?)[\s-]*sub-?\s?factions?$/i);
  return m ? `${m[1]} sub-faction`.trim() : group.name;
}

/** The army-wide choices across all armies in the roster (primary and allied), deduplicated. */
export function rosterArmyChoiceGroups(factions: string[]): Array<{ id: string } & ArmyChoiceGroup> {
  const seen = new Set<string>();
  return factions.flatMap(armyChoiceGroups).filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
}

/** Default picks for an army: each group's first visible option (what the export would use anyway). */
export function defaultArmyChoices(faction: string): ArmyChoices {
  return Object.fromEntries(armyChoiceGroups(faction).flatMap((g) => (g.options[0] ? [[g.id, g.options[0].id]] : [])));
}

/** The army-wide choice groups a unit carries (it has a default from them). */
function groupsCarried(unit: UnitEntry): Set<string> {
  const out = new Set<string>();
  const visit = (ws: WargearEntry[] | undefined) => {
    for (const w of ws ?? []) {
      const g = groupOf(w);
      if (g && rulesData.armyChoices[g]) out.add(g);
      visit(w.children);
    }
  };
  visit(unit.unitWargear);
  const models = (ms: UnitEntry['models']) => ms.forEach((m) => (visit(m.defaultWargear), models(m.models ?? [])));
  models(unit.models);
  return out;
}

/**
 * The picks in force in one detachment. BSData allows one Mechanicum Trait per
 * detachment, and units with a fixed Trait (Tech-Thralls: Lacrymaerta) decide
 * it: where all of a detachment's fixed-Trait units agree, the units choosing
 * a Trait take that one; otherwise the army's pick stands.
 */
export function detachmentChoices(det: PlacedDetachment, choices: ArmyChoices | undefined): ArmyChoices {
  const out: ArmyChoices = { ...choices };
  const units = Object.values(det.slots).flatMap((fs) => (fs ? [fs.unit] : []));
  for (const [groupId, group] of Object.entries(rulesData.armyChoices)) {
    if (!units.some((u) => groupsCarried(u).has(groupId))) continue;
    const fixed = new Set(
      units
        .filter((u) => !groupsCarried(u).has(groupId))
        .flatMap((u) => group.options.filter((o) => (o.counts ?? []).some((id) => (u.facts?.[id] ?? 0) > 0)).map((o) => o.id))
    );
    if (fixed.size === 1) out[groupId] = [...fixed][0];
  }
  return out;
}

/** What a unit's army-wide choices put in the roster (the chosen option and its category), for rule counts. */
export function unitChoiceIds(unit: UnitEntry, choices: ArmyChoices): string[] {
  return [...groupsCarried(unit)].flatMap((groupId) => {
    const group = rulesData.armyChoices[groupId];
    const option = group.options.find((o) => o.id === choices[groupId]) ?? group.options.find((o) => !o.hidden) ?? group.options[0];
    return option ? [option.id, ...(option.counts ?? [])] : [];
  });
}
