import { describe, test, expect } from 'vitest';
import { parseAll, factionKeyForCatalogue, type BsCatalogueFile, type BsGameSystemFile, type BsEntry } from './parse-bsdata';

// Minimal BSData-shaped fixtures. Ids are arbitrary but stable.
const PTS = '9893-c379-920b-8982';
const pts = (value: number) => [{ name: 'Point(s)', typeId: PTS, value }];
const min = (value: number, extra: object = {}) => ({ type: 'min', value, field: 'selections', scope: 'parent', ...extra });
const max = (value: number) => ({ type: 'max', value, field: 'selections', scope: 'parent' });

const LEGION_CAT_ID = 'cat-legion';
const SKITARII_CAT_ID = 'cat-skitarii';
const MECH_CAT_ID = 'cat-mech';

function unhideFor(catalogueId: string) {
  return {
    type: 'set',
    field: 'hidden',
    value: false,
    conditionGroups: [
      {
        type: 'and',
        conditions: [
          { type: 'instanceOf', value: 1, field: 'selections', scope: 'primary-catalogue', childId: catalogueId },
        ],
      },
    ],
  };
}

const gameSystem: BsGameSystemFile = {
  gameSystem: {
    id: 'sys-1',
    name: 'Horus Heresy 3rd Edition',
    revision: 55,
    categoryEntries: [
      { id: 'cat-ootl2', name: 'Officer of the Line (2)' },
      { id: 'cat-troops-qualified', name: 'Troops - Militia only' },
    ],
    sharedSelectionEntryGroups: [
      {
        id: '969e-8b5b-1410-cfc6',
        name: 'High Command Detachment Choice',
        defaultSelectionEntryId: 'one-apex',
        constraints: [min(1), max(1)],
        selectionEntries: [{ id: 'one-apex', name: 'One Apex Detachment', type: 'upgrade' }],
      },
      {
        id: 'shared-force-weapons',
        name: 'Force Weapon',
        defaultSelectionEntryId: 'force-sword',
        entryLinks: [
          { id: 'force-sword', name: 'Force sword', type: 'selectionEntry', targetId: 'x' },
          { id: 'force-axe', name: 'Force axe', type: 'selectionEntry', targetId: 'y' },
        ],
      },
    ],
    forceEntries: [
      {
        id: 'crusade',
        name: 'Crusade Force Organization Chart',
        forceEntries: [
          {
            id: 'primary',
            name: 'Crusade Primary Detachment',
            hidden: true,
            modifiers: [unhideFor(LEGION_CAT_ID), unhideFor(SKITARII_CAT_ID)],
            categoryLinks: [
              { id: 'l1', name: 'Troops', targetId: 'cat-troops', constraints: [{ ...min(2), field: 'selections' }, max(4)] },
              // No constraints: must not borrow the next link's max (old XML parser bug)
              { id: 'l2', name: 'Paragon of Malevolence', targetId: 'cat-paragon' },
              { id: 'l3', name: 'Command - Centurions Only', targetId: 'cat-cent', constraints: [max(2)] },
              { id: 'l4', name: 'Prime Troops', targetId: 'cat-prime-troops', constraints: [max(1)] },
              { id: 'l5', name: 'Elites', targetId: 'cat-elites', constraints: [max(0)] },
              // max 0 but raisable by a modifier (e.g. Logistical Benefit) — kept with its modifiers
              {
                id: 'l7',
                name: 'Retinue',
                targetId: 'cat-retinue',
                constraints: [{ ...max(0), id: 'c-ret' }],
                modifiers: [
                  {
                    type: 'increment',
                    field: 'c-ret',
                    value: 1,
                    conditions: [{ type: 'equalTo', value: 1, field: 'selections', scope: 'force', childId: 'lb-retinue' }],
                  },
                ],
              },
            ],
          },
          {
            id: 'aux-legion-only',
            name: 'Auxiliary - Legion Thing',
            hidden: true,
            // Faction restriction inside a modifierGroup: group conditions must carry through
            modifierGroups: [
              {
                conditions: [
                  { type: 'instanceOf', value: 1, field: 'selections', scope: 'primary-catalogue', childId: LEGION_CAT_ID },
                ],
                modifiers: [{ type: 'set', field: 'hidden', value: false }],
              },
            ],
            categoryLinks: [{ id: 'l6', name: 'Support', targetId: 'cat-support', constraints: [max(2)] }],
          },
        ],
      },
    ],
  },
};

const legionUnits: BsEntry[] = [
  {
    // Single-model unit whose model has no cost of its own: the optional
    // upgrade's 35pts must NOT be counted (old parser gave 460)
    id: 'u-primarch',
    name: 'Perturabo',
    type: 'unit',
    costs: pts(425),
    selectionEntries: [
      { id: 'm-primarch', name: 'Perturabo', type: 'model', constraints: [min(1), max(1)] },
      { id: 'up-logos', name: 'The Logos Array', type: 'upgrade', constraints: [min(1), max(1)] },
      { id: 'up-forge', name: 'Forgebreaker', type: 'upgrade', costs: pts(35), constraints: [max(1)] },
    ],
  },
  {
    id: 'u-squad',
    name: 'Tactical Support Squad',
    type: 'unit',
    selectionEntries: [
      {
        id: 'm-sgt',
        name: 'Sergeant',
        type: 'model',
        costs: pts(20),
        constraints: [min(1), max(1)],
        entryLinks: [
          { id: 'sgt-pistol', name: 'Bolt pistol', type: 'selectionEntry', targetId: 'bp', constraints: [min(1, { automatic: true })] },
        ],
      },
      {
        id: 'm-leg',
        name: 'Legionary',
        type: 'model',
        costs: pts(15),
        constraints: [min(4), max(9)],
        entryLinks: [
          // Link to a shared group: default must be resolved through the index
          { id: 'leg-force', name: 'Force Weapon', type: 'selectionEntryGroup', targetId: 'shared-force-weapons', constraints: [min(1), max(1)] },
          // Group link itself must never be emitted as wargear
          { id: 'leg-arcana', name: 'Prosperine Arcana', type: 'selectionEntryGroup', targetId: 'missing' },
        ],
      },
    ],
    selectionEntryGroups: [
      {
        // Unit-level weapon choice with a default (old parser attached it to the last model by accident)
        id: 'g-special',
        name: 'Legion Special Weapons List',
        defaultSelectionEntryId: 'sw-flamer',
        constraints: [min(1), max(1)],
        entryLinks: [
          { id: 'sw-flamer', name: 'Flamer', type: 'selectionEntry', targetId: 'f' },
          { id: 'sw-plasma', name: 'Plasma gun', type: 'selectionEntry', targetId: 'p' },
        ],
      },
      {
        // Disabled (max 0, no modifiers) — default must be ignored
        id: 'g-disabled',
        name: 'Disabled swap',
        defaultSelectionEntryId: 'dis-1',
        constraints: [min(0), max(0)],
        entryLinks: [{ id: 'dis-1', name: 'Volkite cavitor', type: 'selectionEntry', targetId: 'v' }],
      },
    ],
    entryLinks: [
      { id: 'squad-frags', name: 'Frag grenades', type: 'selectionEntry', targetId: 'fg', constraints: [min(1), max(1)] },
      { id: 'squad-hidden', name: 'Hidden thing', type: 'selectionEntry', targetId: 'h', hidden: true, constraints: [min(1)] },
    ],
  },
  {
    id: 'u-centurion',
    name: 'Centurion',
    type: 'unit',
    costs: pts(65),
    categoryLinks: [{ id: 'c-ootl', name: 'Officer of the Line (2)', targetId: 'cat-ootl2' }],
    selectionEntries: [{ id: 'm-cent', name: 'Centurion', type: 'model', constraints: [min(1), max(1)] }],
    entryLinks: [{ id: 'hc-choice', name: 'High Command Detachment Choice', type: 'selectionEntryGroup', targetId: '969e-8b5b-1410-cfc6' }],
  },
  {
    // Model variants inside a choice group (Caladius Grav-Tank pattern)
    id: 'u-grav',
    name: 'Grav-Tank',
    type: 'unit',
    selectionEntryGroups: [
      {
        id: 'g-type',
        name: 'Type',
        defaultSelectionEntryId: 'm-grav-b',
        constraints: [min(1), max(1)],
        selectionEntries: [
          { id: 'm-grav-a', name: 'Grav-Tank A', type: 'model', costs: pts(225), constraints: [min(0), max(1)] },
          { id: 'm-grav-b', name: 'Grav-Tank B', type: 'model', costs: pts(235), constraints: [min(0), max(1)] },
        ],
      },
    ],
  },
];

const legion: BsCatalogueFile = {
  catalogue: {
    id: LEGION_CAT_ID,
    name: '                         III - Emperor’s Test Legion',
    revision: 7,
    sharedSelectionEntries: legionUnits,
    entryLinks: [
      { id: 'link-primarch', name: 'Perturabo', type: 'selectionEntry', targetId: 'u-primarch', categoryLinks: [{ id: 'x1', name: 'Warlord', targetId: 'w', primary: true }] },
      // Qualified link first, plain link second: the plain role must win
      { id: 'link-squad-log', name: 'TSS', type: 'selectionEntry', targetId: 'u-squad', categoryLinks: [{ id: 'x2', name: 'Troops - Logisticae', targetId: 't2', primary: true }] },
      { id: 'link-squad', name: 'TSS', type: 'selectionEntry', targetId: 'u-squad', categoryLinks: [{ id: 'x3', name: 'Troops', targetId: 'cat-troops', primary: true }] },
      { id: 'link-cent', name: 'Centurion', type: 'selectionEntry', targetId: 'u-centurion', categoryLinks: [{ id: 'x4', name: 'Command', targetId: 'cmd', primary: true }] },
      { id: 'link-grav', name: 'Grav-Tank', type: 'selectionEntry', targetId: 'u-grav', categoryLinks: [{ id: 'x5', name: 'Armour', targetId: 'arm', primary: true }] },
    ],
  },
};

const mech: BsCatalogueFile = {
  catalogue: {
    id: MECH_CAT_ID,
    name: 'Mechanicum',
    revision: 26,
    sharedSelectionEntries: [
      {
        id: 'u-krios',
        name: 'Krios Battle Tank',
        type: 'unit',
        costs: pts(135),
        selectionEntries: [
          { id: 'm-krios', name: 'Krios', type: 'model', constraints: [min(1), max(1)] },
          // Mandatory only in a Mechanicum army
          {
            id: 'cyb',
            name: 'Cybernetica',
            type: 'upgrade',
            constraints: [{ ...min(1), id: 'cyb-min' }],
            modifiers: [{
              type: 'set',
              field: 'cyb-min',
              value: 0,
              conditionGroups: [{
                type: 'or',
                conditions: [
                  { type: 'instanceOf', value: 1, field: 'forces', scope: 'force', childId: 'vagus' },
                  { type: 'notInstanceOf', value: 1, field: 'selections', scope: 'primary-catalogue', childId: MECH_CAT_ID },
                ],
              }],
            }],
          },
        ],
        // A required choice with no default: the first free option is taken
        selectionEntryGroups: [{
          id: 'krios-weapon',
          name: 'Weapon',
          constraints: [min(1), max(1)],
          selectionEntries: [
            { id: 'w-big', name: 'Big gun', type: 'upgrade', costs: pts(10) },
            { id: 'w-zeta', name: 'Zeta blade', type: 'upgrade' },
            { id: 'w-alpha', name: 'alpha rifle', type: 'upgrade' },
          ],
        }],
      },
      { id: 'u-troop', name: 'Infantry Troop', type: 'unit', costs: pts(60) },
    ],
  },
};

const skitarii: BsCatalogueFile = {
  catalogue: {
    id: SKITARII_CAT_ID,
    name: 'Skitarii Conclaves',
    revision: 1,
    sharedSelectionEntries: [],
    entryLinks: [
      // Unit defined in another catalogue, with a *conditional* set-primary
      // inside a modifierGroup that must not apply at parse time
      {
        id: 'sk-krios',
        name: 'Krios Battle Tank',
        type: 'selectionEntry',
        targetId: 'u-krios',
        categoryLinks: [{ id: 's1', name: 'Armour', targetId: 'arm', primary: true }],
        modifiers: [{ type: 'set', field: 'name', value: 'Skitarii Krios' }],
        // Choices attached to the link itself (paths don't include the link id)
        selectionEntryGroups: [{
          id: 'sk-subfac',
          name: 'Sub Factions',
          constraints: [min(1), max(1)],
          selectionEntries: [
            { id: 'sf-exp', name: 'Expurgator', type: 'upgrade', sortIndex: 2 },
            { id: 'sf-acq', name: 'Acquisitor', type: 'upgrade', sortIndex: 1 },
          ],
        }],
        modifierGroups: [
          {
            conditions: [{ type: 'instanceOf', value: 1, field: 'forces', scope: 'force', childId: 'vagus' }],
            modifiers: [{ type: 'set-primary', field: 'category', value: 'cat-troops-qualified' }],
          },
        ],
      },
      // Unconditional set-primary re-files the unit into a qualified category
      {
        id: 'sk-troop',
        name: 'Infantry Troop',
        type: 'selectionEntry',
        targetId: 'u-troop',
        categoryLinks: [{ id: 's2', name: 'Troops', targetId: 'cat-troops', primary: true }],
        modifiers: [{ type: 'set-primary', field: 'category', value: 'cat-troops-qualified' }],
      },
    ],
  },
};

function parse() {
  return parseAll({
    gameSystem,
    catalogues: [legion, mech, skitarii],
    unitFactions: ['emperors-test-legion', 'skitarii-conclaves', 'not-a-faction'],
  });
}

function unit(faction: string, name: string) {
  const u = parse().units[faction].find((x) => x.name === name);
  if (!u) throw new Error(`no unit ${name} in ${faction}`);
  return u;
}

describe('factionKeyForCatalogue', () => {
  test('strips roman numerals, apostrophes and whitespace', () => {
    expect(factionKeyForCatalogue("                         III - Emperor's Children")).toBe('emperors-children');
    expect(factionKeyForCatalogue('Skitarii Conclaves')).toBe('skitarii-conclaves');
  });
});

describe('units', () => {
  test('does not count optional upgrade costs when a model has no cost of its own', () => {
    const u = unit('emperors-test-legion', 'Perturabo');
    expect(u.points).toBe(425);
    expect(u.unitWargear?.map((w) => w.name)).toEqual(['The Logos Array']);
  });

  test('points = base + model cost × min', () => {
    const u = unit('emperors-test-legion', 'Tactical Support Squad');
    expect(u.points).toBe(20 + 15 * 4);
    expect(u.models.map((m) => [m.name, m.min, m.max])).toEqual([
      ['Sergeant', 1, 1],
      ['Legionary', 4, 9],
    ]);
  });

  test('prefers the plain battlefield-role link over a qualified one', () => {
    const u = unit('emperors-test-legion', 'Tactical Support Squad');
    expect(u.entryId).toBe('link-squad');
    expect(u.role).toBe('Troops');
    expect(u.primaryCategory).toBe('Troops');
  });

  test('collects mandatory wargear at unit and model level', () => {
    const u = unit('emperors-test-legion', 'Tactical Support Squad');
    expect(u.unitWargear?.map((w) => w.name)).toEqual(['Frag grenades', 'Flamer']);
    expect(u.models[0].defaultWargear.map((w) => w.name)).toEqual(['Bolt pistol']);
    // Shared group default resolved (path enters the group link's target); group links never emitted
    expect(u.models[1].defaultWargear).toEqual([
      {
        name: 'Force sword',
        entryId: 'force-sword',
        targetId: 'x',
        path: 'link-squad::leg-force::force-sword::x',
        groupPath: 'link-squad::leg-force::shared-force-weapons',
      },
    ]);
  });

  test('leaves force-org detachment choices to the exporter', () => {
    const u = unit('emperors-test-legion', 'Centurion');
    expect(u.unitWargear).toBeUndefined();
    expect(u.officerOfTheLine).toBe(2);
  });

  test('takes the default model from a model-variant group', () => {
    const u = unit('emperors-test-legion', 'Grav-Tank');
    expect(u.points).toBe(235);
    expect(u.models.map((m) => m.name)).toEqual(['Grav-Tank B']);
  });

  test('resolves units linked from another catalogue', () => {
    const u = unit('skitarii-conclaves', 'Skitarii Krios');
    expect(u.entryId).toBe('sk-krios');
    expect(u.points).toBe(135);
    expect(u.source).toBe('skitarii-conclaves');
    expect(u.primaryCategory).toBe('Armour'); // conditional re-file ignored
  });

  test('fills required choices and settles primary-catalogue constraint modifiers', () => {
    const u = unit('skitarii-conclaves', 'Skitarii Krios');
    expect(u.unitWargear?.map((w) => [w.name, w.path, w.groupPath])).toEqual([
      ['alpha rifle', 'sk-krios::w-alpha', 'sk-krios::krios-weapon'],
      ['Acquisitor', 'sf-acq', 'sk-subfac'],
    ]); // no Cybernetica outside a Mechanicum army
  });

  test('applies unconditional set-primary modifiers', () => {
    const u = unit('skitarii-conclaves', 'Infantry Troop');
    expect(u.role).toBe('Troops');
    expect(u.primaryCategory).toBe('Troops - Militia only');
  });

  test('warns about unknown factions', () => {
    expect(parse().warnings).toContain('No catalogue found for faction "not-a-faction"');
  });
});

describe('detachments', () => {
  test('slots from links with a positive or raisable max, without borrowing neighbours', () => {
    const primary = parse().detachments.charts[0].detachments[0];
    expect(primary.slots.map((s) => [s.role, s.min, s.max, s.prime])).toEqual([
      ['Troops', 2, 4, false],
      ['Command - Centurions Only', 0, 2, false],
      ['Prime Troops', 0, 1, true],
      ['Retinue', 0, 0, false],
    ]);
    expect(primary.slots[3].maxModifiers).toEqual([
      {
        type: 'increment',
        field: 'c-ret',
        value: 1,
        conditions: [{ type: 'equalTo', scope: 'force', field: 'selections', value: 1, childId: 'lb-retinue' }],
      },
    ]);
  });

  test('faction sources come from instanceOf primary-catalogue conditions', () => {
    const [primary, aux] = parse().detachments.charts[0].detachments;
    expect(primary.sources).toEqual(['emperors-test-legion', 'skitarii-conclaves']);
    // …including conditions on a modifierGroup
    expect(aux.sources).toEqual(['emperors-test-legion']);
  });

  test('system info', () => {
    expect(parse().system).toEqual({
      gameSystemId: 'sys-1',
      gameSystemName: 'Horus Heresy 3rd Edition',
      revision: 55,
      forceOrgEntryId: 'crusade',
    });
  });
});
