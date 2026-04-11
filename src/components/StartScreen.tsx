import React, { useState } from 'react';
import { Button, NumberInput, Select, SelectItem } from '@carbon/react';
import type { Allegiance } from '../types';
import { useRosterStore } from '../store/rosterStore';
import { FACTIONS, FACTION_LABEL_MAP } from '../data/factions';

export default function StartScreen() {
  const startBuild = useRosterStore((s) => s.startBuild);

  const [faction, setFaction] = useState(FACTIONS[0].id);
  const [allegiance, setAllegiance] = useState<Allegiance>('Traitor');
  const [pointsLimit, setPointsLimit] = useState(3000);

  function handleStart() {
    startBuild(faction, allegiance, pointsLimit);
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
            labelText="Legion"
            value={faction}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFaction(e.target.value)}
          >
            {FACTIONS.map((f) => (
              <SelectItem key={f.id} value={f.id} text={f.label} />
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

        {/* Footer */}
        <p
          className="text-center text-xs mt-6"
          style={{ color: 'var(--cds-text-placeholder)' }}
        >
          {faction && allegiance
            ? `${FACTION_LABEL_MAP[faction] ?? faction} · ${allegiance} · ${pointsLimit}pts`
            : 'Select a legion to continue'}
        </p>
      </div>
    </div>
  );
}
