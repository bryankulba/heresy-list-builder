import React, { useState } from 'react';
import { Button, NumberInput, Select, SelectItem, SelectItemGroup } from '@carbon/react';
import type { Allegiance } from '../types';
import { useRosterStore } from '../store/rosterStore';
import { FACTIONS, FACTION_GROUPS, factionLabel } from '../data/factions';
import { COHORT_DOCTRINES } from '../constants/cohortDoctrines';
import { armyChoiceGroups, armyChoiceLabel, defaultArmyChoices } from '../rules/armyChoices';
import SavedListsModal from './modals/SavedListsModal';

export default function StartScreen() {
  const startBuild = useRosterStore((s) => s.startBuild);

  const [faction, setFaction] = useState(FACTIONS[0].id);
  const [allegiance, setAllegiance] = useState<Allegiance>('Loyalist');
  const [pointsLimit, setPointsLimit] = useState(3000);
  const [cohortDoctrine, setCohortDoctrine] = useState('');
  const [armyChoices, setArmyChoices] = useState(() => defaultArmyChoices(FACTIONS[0].id));
  const choiceGroups = armyChoiceGroups(faction);
  const [showSavedLists, setShowSavedLists] = useState(false);

  function handleFactionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setFaction(next);
    if (next !== 'solar-auxilia') setCohortDoctrine('');
    setArmyChoices(defaultArmyChoices(next));
  }

  function handleStart() {
    startBuild(faction, allegiance, pointsLimit, cohortDoctrine, armyChoices);
  }

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

        {/* Cohort Doctrine (Solar Auxilia only) */}
        {faction === 'solar-auxilia' && (
          <div className="mb-6">
            <Select
              id="cohort-doctrine-select"
              labelText="Cohort Doctrine"
              value={cohortDoctrine}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCohortDoctrine(e.target.value)}
            >
              <SelectItem value="" text="— Select Cohort Doctrine —" />
              {COHORT_DOCTRINES.map((d) => (
                <SelectItem key={d.id} value={d.id} text={d.name} />
              ))}
            </Select>
          </div>
        )}

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
            ? `${factionLabel(faction)} · ${allegiance} · ${pointsLimit}pts`
            : 'Select an army to continue'}
        </p>
      </div>

      {showSavedLists && (
        <SavedListsModal onClose={() => setShowSavedLists(false)} />
      )}
    </div>
  );
}
