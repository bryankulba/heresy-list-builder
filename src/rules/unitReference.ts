/**
 * unitReference.ts
 * The army's units by battlefield role, for the header's unit reference: what
 * each role holds, with sizes, points and the things worth knowing before
 * picking (Legion-specific, unique, one allegiance only, not in Zone Mortalis).
 */

import type { Allegiance, Force, UnitEntry } from '../types';
import { SM_LEGION_KEYS } from '../data/factions';
import { getUnitsForFaction } from '../data/loader';
import { allegianceCounts, chartBan, isAllegianceLocked } from './availability';
import { isSizeAdjustable } from './unitSize';

/** Battlefield roles in force-org order; anything else follows alphabetically */
const ROLE_ORDER = [
  'Warlord',
  'High Command',
  'Command',
  'Retinue',
  'Elites',
  'Troops',
  'Support',
  'Transport',
  'Heavy Transport',
  'Heavy Assault',
  'Armour',
  'War-engine',
  'Recon',
  'Fast Attack',
  'Lord of War',
];

/** BSData spells War-engine both ways */
const roleLabel = (role: string) => (role === 'War Engine' ? 'War-engine' : role);

export interface ReferenceUnit {
  unit: UnitEntry;
  /** "10–20 models", "5 models", or '' for a single model */
  size: string;
  /** Its points can grow with more models */
  fromPoints: boolean;
  tags: Array<{ label: string; kind: 'legion' | 'unique' | 'allegiance' | 'banned' | 'operative' }>;
}

export interface ReferenceGroup {
  role: string;
  units: ReferenceUnit[];
}

function sizeText(unit: UnitEntry): string {
  const min = unit.models.reduce((n, m) => n + m.min, 0);
  const max = unit.models.reduce((n, m) => n + Math.max(m.min, m.max), 0);
  if (max <= 1) return '';
  return min === max ? `${min} models` : `${min}–${max} models`;
}

/** The units `force` can field, grouped by role, in force-org order. */
export function unitReference(forces: Force[], force: Force, allegiance: Allegiance): ReferenceGroup[] {
  const det = force.detachments[0];
  const other: Allegiance = allegiance === 'Loyalist' ? 'Traitor' : 'Loyalist';
  const own = allegianceCounts(forces, allegiance);
  const theirs = allegianceCounts(forces, other);
  const isLegion = SM_LEGION_KEYS.has(force.faction);

  const groups = new Map<string, ReferenceUnit[]>();
  const seen = new Set<string>();
  for (const unit of getUnitsForFaction(force.faction)) {
    const key = unit.path ?? unit.entryId ?? unit.name;
    if (seen.has(key) || unit.points <= 0) continue;
    seen.add(key);

    const tags: ReferenceUnit['tags'] = [];
    if (isLegion && unit.source === force.faction) tags.push({ label: 'Legion', kind: 'legion' });
    if (unit.source === 'divisio-assassinorum') tags.push({ label: 'Assassin', kind: 'operative' });
    if (unit.source === 'cults-abominatio') tags.push({ label: 'Cult', kind: 'operative' });
    if (unit.rosterMax === 1) tags.push({ label: 'Unique', kind: 'unique' });
    if (det && isAllegianceLocked(forces, force, det, unit, own)) tags.push({ label: `${other} only`, kind: 'allegiance' });
    else if (det && isAllegianceLocked(forces, force, det, unit, theirs)) tags.push({ label: `${allegiance} only`, kind: 'allegiance' });
    const ban = chartBan(force, unit);
    if (ban) tags.push({ label: 'Not in Zone Mortalis', kind: 'banned' });

    const role = roleLabel(unit.role);
    groups.set(role, [
      ...(groups.get(role) ?? []),
      { unit, size: sizeText(unit), fromPoints: unit.models.some(isSizeAdjustable), tags },
    ]);
  }

  const rank = (role: string) => {
    const i = ROLE_ORDER.indexOf(role);
    return i === -1 ? ROLE_ORDER.length : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([role, units]) => ({ role, units: units.sort((a, b) => a.unit.name.localeCompare(b.unit.name)) }));
}
