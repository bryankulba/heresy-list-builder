export interface FactionDef {
  id: string;
  label: string;
}

const SM_LEGION_LIST: FactionDef[] = [
  { id: 'dark-angels',       label: 'I — Dark Angels' },
  { id: 'emperors-children', label: "III — Emperor's Children" },
  { id: 'iron-warriors',     label: 'IV — Iron Warriors' },
  { id: 'white-scars',       label: 'V — White Scars' },
  { id: 'space-wolves',      label: 'VI — Space Wolves' },
  { id: 'imperial-fists',    label: 'VII — Imperial Fists' },
  { id: 'night-lords',       label: 'VIII — Night Lords' },
  { id: 'blood-angels',      label: 'IX — Blood Angels' },
  { id: 'iron-hands',        label: 'X — Iron Hands' },
  { id: 'world-eaters',      label: 'XII — World Eaters' },
  { id: 'ultramarines',      label: 'XIII — Ultramarines' },
  { id: 'death-guard',       label: 'XIV — Death Guard' },
  { id: 'thousand-sons',     label: 'XV — Thousand Sons' },
  { id: 'sons-of-horus',     label: 'XVI — Sons of Horus' },
  { id: 'word-bearers',      label: 'XVII — Word Bearers' },
  { id: 'salamanders',       label: 'XVIII — Salamanders' },
  { id: 'raven-guard',       label: 'XIX — Raven Guard' },
  { id: 'alpha-legion',      label: 'XX — Alpha Legion' },
];

const OTHER_FACTIONS: FactionDef[] = [
  { id: 'mechanicum',    label: 'Mechanicum' },
  { id: 'solar-auxilia', label: 'Solar Auxilia' },
];

export const FACTIONS: FactionDef[] = [...SM_LEGION_LIST, ...OTHER_FACTIONS];

/** Keep SM_LEGIONS as an alias for backward compatibility */
export const SM_LEGIONS = FACTIONS;

export const FACTION_LABEL_MAP: Record<string, string> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f.label])
);

/** Set of SM legion keys — used in loader to determine whether to merge LA base units */
export const SM_LEGION_KEYS = new Set(SM_LEGION_LIST.map((f) => f.id));
