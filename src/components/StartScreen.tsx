import { getDetachmentDisplayName, loadFactionUnits, zoneMortalisPrimaries } from '../data/loader';
import React, { useEffect, useState } from 'react';
import { Button, NumberInput, Select, SelectItem, SelectItemGroup } from '@carbon/react';
import type { Allegiance, DetachmentDef } from '../types';
import { useRosterStore } from '../store/rosterStore';
import { FACTIONS, FACTION_GROUPS, ZONE_MORTALIS_CHART, factionLabel } from '../data/factions';
import { configOptions, defaultConfigChoices, doctrineLabel, doctrineOptions } from '../rules/armyConfig';
import { armyChoiceGroups, armyChoiceLabel, defaultArmyChoices } from '../rules/armyChoices';
import SavedListsModal from './modals/SavedListsModal';

/** Default points limits per game type */
const CRUSADE_POINTS = 3000;
const ZM_POINTS = 1500;

/**
 * "1 High Command · 1 Command · 4 Troops (1 Prime) · 2 Heavy Assault (1 Prime)" —
 * the detachment's plain roles, as BSData's composition text puts it (qualified
 * and benefit-only slots like "Command - Centurions Only" or Clade Operative left out).
 */
function slotSummary(def: DetachmentDef): string {
  const plain = def.slots.filter((s) => s.max > 0 && !s.role.includes(' - ') && !/Operative$/.test(s.role));
  return plain
    .filter((s) => !s.prime)
    .map((s) => {
      const prime = plain.find((p) => p.prime && p.role === `Prime ${s.role}`)?.max;
      return `${s.max} ${s.role}${prime ? ` (${prime} Prime)` : ''}`;
    })
    .join(' · ');
}

export default function StartScreen() {
  const startBuild = useRosterStore((s) => s.startBuild);

  const [faction, setFaction] = useState(FACTIONS[0].id);
  const [allegiance, setAllegiance] = useState<Allegiance>('Loyalist');
  const [pointsLimit, setPointsLimit] = useState(CRUSADE_POINTS);
  const [cohortDoctrine, setCohortDoctrine] = useState('');
  const [armyChoices, setArmyChoices] = useState<Record<string, string>>({});
  // The army's units load when it's picked; its sub-faction choices come from them
  const [loadedFaction, setLoadedFaction] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    loadFactionUnits(faction).then(() => {
      if (!current) return;
      setLoadedFaction(faction);
      setArmyChoices(defaultArmyChoices(faction));
    });
    return () => {
      current = false;
    };
  }, [faction]);
  const choiceGroups = loadedFaction === faction ? armyChoiceGroups(faction) : [];
  const [configChoices, setConfigChoices] = useState(() => defaultConfigChoices(FACTIONS[0].id));
  const settings = configOptions(faction);
  const [showSavedLists, setShowSavedLists] = useState(false);
  // Game type: a Crusade army, or Zone Mortalis on one of its primary detachments (from BSData)
  const [zoneMortalis, setZoneMortalis] = useState(false);
  const zmPrimaries = zoneMortalisPrimaries(faction);
  const [zmPrimary, setZmPrimary] = useState('');
  const zmPrimaryDef = zmPrimaries.find((d) => d.name === zmPrimary) ?? zmPrimaries[0];
  const playingZm = zoneMortalis && !!zmPrimaryDef;

  function handleFactionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setFaction(next);
    if (!doctrineOptions(next).includes(cohortDoctrine)) setCohortDoctrine('');
    setConfigChoices(defaultConfigChoices(next));
    // An army without Zone Mortalis (Knights) goes back to a Crusade
    if (zoneMortalis && zoneMortalisPrimaries(next).length === 0) {
      setZoneMortalis(false);
      if (pointsLimit === ZM_POINTS) setPointsLimit(CRUSADE_POINTS);
    }
  }

  function handleStart() {
    startBuild(
      faction,
      allegiance,
      pointsLimit,
      cohortDoctrine,
      armyChoices,
      configChoices,
      playingZm ? { chart: ZONE_MORTALIS_CHART, primary: zmPrimaryDef.name } : undefined
    );
  }

  /** Two-way toggle, styled like the allegiance buttons */
  const toggle = <T extends string>(options: Array<{ value: T; label: string }>, value: T, onChange: (v: T) => void) => (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="flex-1 py-2 px-4 rounded transition-colors text-sm font-medium"
          style={{
            background: value === o.value ? 'var(--cds-layer-selected-01)' : 'var(--cds-layer-02)',
            border: `1px solid ${value === o.value ? 'var(--cds-interactive)' : 'var(--cds-border-subtle-01)'}`,
            color: 'var(--cds-text-primary)',
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-cds-background">
      <div
        className="w-full max-w-md p-8 rounded"
        style={{ background: 'var(--cds-layer-01)', border: '1px solid var(--cds-border-subtle-01)' }}
      >
        {/* Title */}
        <div className="mb-8 text-center">
          <p
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: 'var(--cds-text-secondary)' }}
          >
            Horus Heresy 3rd Edition
          </p>
          <h1
            className="text-3xl font-light"
            style={{ color: 'var(--cds-text-primary)' }}
          >
            List Builder
          </h1>
        </div>

        {/* Faction */}
        <div className="mb-6">
          <Select
            id="faction-select"
            labelText="Army"
            value={faction}
            onChange={handleFactionChange}
          >
            {FACTION_GROUPS.map((group) => (
              <SelectItemGroup key={group} label={group}>
                {FACTIONS.filter((f) => f.group === group).map((f) => (
                  <SelectItem key={f.id} value={f.id} text={f.label} />
                ))}
              </SelectItemGroup>
            ))}
          </Select>
        </div>

        {/* Game type: Crusade or Zone Mortalis (armies BSData gives Zone Mortalis primaries) */}
        {zmPrimaries.length > 0 && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--cds-text-secondary)' }}>
              Game type
            </p>
            {toggle(
              [
                { value: 'crusade', label: 'Crusade' },
                { value: 'zm', label: 'Zone Mortalis' },
              ],
              zoneMortalis ? 'zm' : 'crusade',
              (v) => {
                const zm = v === 'zm';
                if (zm === zoneMortalis) return;
                setZoneMortalis(zm);
                // Each game type's usual size; switching back undoes only the default
                if (zm) setPointsLimit(ZM_POINTS);
                else if (pointsLimit === ZM_POINTS) setPointsLimit(CRUSADE_POINTS);
              }
            )}
            {zoneMortalis && zmPrimaryDef && (
              <div className="mt-4">
                <Select
                  id="zm-primary-select"
                  labelText="Primary detachment"
                  helperText={slotSummary(zmPrimaryDef)}
                  value={zmPrimaryDef.name}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setZmPrimary(e.target.value)}
                >
                  {zmPrimaries.map((d) => (
                    <SelectItem key={d.name} value={d.name} text={getDetachmentDisplayName(d.name)} />
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Allegiance */}
        <div className="mb-6">
          <p
            className="text-xs uppercase tracking-wide mb-2"
            style={{ color: 'var(--cds-text-secondary)' }}
          >
            Allegiance
          </p>
          <div className="flex gap-2">
            {(['Loyalist', 'Traitor'] as Allegiance[]).map((a) => (
              <button
                key={a}
                onClick={() => setAllegiance(a)}
                className="flex-1 py-2 px-4 rounded transition-colors text-sm font-medium"
                style={{
                  background:
                    allegiance === a
                      ? 'var(--cds-layer-selected-01)'
                      : 'var(--cds-layer-02)',
                  border: `1px solid ${allegiance === a ? 'var(--cds-interactive)' : 'var(--cds-border-subtle-01)'}`,
                  color: 'var(--cds-text-primary)',
                  cursor: 'pointer',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Cohort Doctrine (Solar Auxilia), from BSData */}
        {doctrineOptions(faction).length > 0 && (
          <div className="mb-6">
            <Select
              id="cohort-doctrine-select"
              labelText="Cohort Doctrine"
              value={cohortDoctrine}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCohortDoctrine(e.target.value)}
            >
              <SelectItem value="" text="— Select Cohort Doctrine —" />
              {doctrineOptions(faction).map((d) => (
                <SelectItem key={d} value={d} text={doctrineLabel(d)} />
              ))}
            </Select>
          </div>
        )}

        {/* Army settings from BSData (Rite of War, Household Paradigm, Provenances of War…) */}
        {settings.map((o) => (
          <div className="mb-6" key={o.name}>
            <Select
              id={`config-${o.name}`}
              labelText={o.name}
              value={configChoices[o.name] ?? ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setConfigChoices((c) => {
                  const { [o.name]: _old, ...rest } = c;
                  return e.target.value ? { ...rest, [o.name]: e.target.value } : rest;
                })
              }
            >
              {o.optional && <SelectItem value="" text="— None —" />}
              {o.choices.map((c) => (
                <SelectItem key={c} value={c} text={c} />
              ))}
            </Select>
          </div>
        ))}

        {/* Army-wide picks for per-unit choices (Skitarii / Mechanicum sub-faction) */}
        {choiceGroups.map((g) => (
          <div className="mb-6" key={g.id}>
            <Select
              id={`army-choice-${g.id}`}
              labelText={armyChoiceLabel(g)}
              helperText="Applied to every unit that takes one"
              value={armyChoices[g.id] ?? ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setArmyChoices((c) => ({ ...c, [g.id]: e.target.value }))
              }
            >
              {g.options.map((o) => (
                <SelectItem key={o.id} value={o.id} text={o.name} />
              ))}
            </Select>
          </div>
        ))}

        {/* Points Limit */}
        <div className="mb-8">
          <NumberInput
            id="points-limit"
            label="Points Limit"
            value={pointsLimit}
            min={500}
            max={10000}
            step={500}
            onChange={(_e: React.SyntheticEvent, data: { value: string | number }) => {
              const v = typeof data.value === 'number' ? data.value : parseInt(String(data.value), 10);
              if (!isNaN(v)) setPointsLimit(v);
            }}
          />
        </div>

        {/* Start */}
        <Button
          kind="primary"
          size="lg"
          className="w-full"
          onClick={handleStart}
          disabled={!faction}
          style={{ width: '100%' }}
        >
          Build Army
        </Button>

        {/* Load a saved list or import a .ros */}
        <Button
          kind="ghost"
          size="md"
          onClick={() => setShowSavedLists(true)}
          style={{ width: '100%', marginTop: 12 }}
        >
          Saved Lists &amp; Import…
        </Button>

        {/* Footer */}
        <p
          className="text-center text-xs mt-6"
          style={{ color: 'var(--cds-text-placeholder)' }}
        >
          {faction && allegiance
            ? `${factionLabel(faction)} · ${allegiance}${playingZm ? ' · Zone Mortalis' : ''} · ${pointsLimit}pts`
            : 'Select an army to continue'}
        </p>
      </div>

      {showSavedLists && (
        <SavedListsModal onClose={() => setShowSavedLists(false)} />
      )}
    </div>
  );
}
