/**
 * armyChoices.ts
 * Choices BSData asks for on every unit but that are really made once for the
 * army — a Skitarii or Mechanicum unit's sub-faction. The roster keeps one pick
 * per choice group (`armyChoices`: group id → option id) and the export applies
 * it to every unit carrying that group.
 */

import type { UnitEntry, WargearEntry } from '../types';
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

/** The army-wide choices an army of `faction` makes, with the options visible to it. */
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
  const groups = choiceGroupIds(getUnitsForFaction(faction)).map((id) => {
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
