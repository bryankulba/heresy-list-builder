/**
 * Faction registry — every army the builder can field, as a primary force or an
 * ally. Ids match the faction keys in data/parsed (slugified BSData catalogue
 * names), so a faction's catalogue, detachment `sources` and units line up.
 *
 * Only facts BSData can't give us directly live here: display labels, grouping,
 * which unit lists merge (the Legiones Astartes base list), which force org
 * chart an army is built on, and its auto-added primary detachment.
 */

export type FactionGroup =
  | 'Legiones Astartes'
  | 'Mechanicum'
  | 'Solar Auxilia'
  | 'Talons of the Emperor'
  | 'Questoris Familia';

export interface FactionDef {
  id: string;
  label: string;
  group: FactionGroup;
  /** Keys into units.json whose units this faction can field */
  unitSources: string[];
  /** Root force entry name of the force org chart the army is built on */
  chart: string;
  /** Detachment auto-added when the army is created */
  primaryDetachment: string;
  /** May this army include Allied Detachments? */
  canTakeAllies: boolean;
}

export const CRUSADE_CHART = 'Crusade Force Organization Chart';
export const ALLIED_CHART = 'Allied Detachment and its Auxiliary';
export const ALLIED_DETACHMENT = 'Allied Detachment';
/** The Lord of War Detachment: a root force holding its Lords of War itself */
export const LORD_OF_WAR_CHART = 'Lord of War Detachment';
const KNIGHT_CHART = 'Knight Households Crusade';

/** Assassins (Clade Operative) and the Cults' Abomination (Cult Operative), open to any Crusade army */
const OPERATIVE_SOURCES = ['divisio-assassinorum', 'cults-abominatio'];

function crusade(id: string, label: string, group: FactionGroup, unitSources: string[] = [id]): FactionDef {
  return {
    id,
    label,
    group,
    unitSources: [...unitSources, ...OPERATIVE_SOURCES],
    chart: CRUSADE_CHART,
    primaryDetachment: 'Crusade Primary Detachment',
    canTakeAllies: true,
  };
}

function legion(id: string, label: string): FactionDef {
  return crusade(id, label, 'Legiones Astartes', ['legiones-astartes', id]);
}

const SM_LEGION_LIST: FactionDef[] = [
  legion('dark-angels',       'I — Dark Angels'),
  legion('emperors-children', "III — Emperor's Children"),
  legion('iron-warriors',     'IV — Iron Warriors'),
  legion('white-scars',       'V — White Scars'),
  legion('space-wolves',      'VI — Space Wolves'),
  legion('imperial-fists',    'VII — Imperial Fists'),
  legion('night-lords',       'VIII — Night Lords'),
  legion('blood-angels',      'IX — Blood Angels'),
  legion('iron-hands',        'X — Iron Hands'),
  legion('world-eaters',      'XII — World Eaters'),
  legion('ultramarines',      'XIII — Ultramarines'),
  legion('death-guard',       'XIV — Death Guard'),
  legion('thousand-sons',     'XV — Thousand Sons'),
  legion('sons-of-horus',     'XVI — Sons of Horus'),
  legion('word-bearers',      'XVII — Word Bearers'),
  legion('salamanders',       'XVIII — Salamanders'),
  legion('raven-guard',       'XIX — Raven Guard'),
  legion('alpha-legion',      'XX — Alpha Legion'),
];

const OTHER_FACTIONS: FactionDef[] = [
  crusade('mechanicum',         'Mechanicum',                         'Mechanicum'),
  crusade('skitarii-conclaves', 'Skitarii Conclaves',                 'Mechanicum'),
  crusade('solar-auxilia',      'Solar Auxilia',                      'Solar Auxilia'),
  crusade('legio-custodes',     'Legio Custodes',                     'Talons of the Emperor'),
  crusade('anathema-psykana',   'Anathema Psykana (Sisters of Silence)', 'Talons of the Emperor'),
  {
    id: 'questoris-familia',
    label: 'Questoris Familia (Knight Households)',
    group: 'Questoris Familia',
    unitSources: ['questoris-familia'],
    chart: KNIGHT_CHART,
    primaryDetachment: 'Knight Households Primary Detachment',
    // BSData: "Questoris Household Armies may not contain Allied Detachments"
    canTakeAllies: false,
  },
];

export const FACTIONS: FactionDef[] = [...SM_LEGION_LIST, ...OTHER_FACTIONS];

export const FACTION_GROUPS: FactionGroup[] = [
  'Legiones Astartes',
  'Mechanicum',
  'Solar Auxilia',
  'Talons of the Emperor',
  'Questoris Familia',
];

export const FACTION_BY_ID: Record<string, FactionDef> = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));

export const FACTION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f.label])
);

/** Set of SM legion keys */
export const SM_LEGION_KEYS = new Set(SM_LEGION_LIST.map((f) => f.id));

export function factionLabel(id: string): string {
  return FACTION_LABEL_MAP[id] ?? id;
}
