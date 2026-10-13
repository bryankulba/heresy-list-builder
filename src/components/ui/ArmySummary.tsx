/**
 * ArmySummary.tsx
 * The army line — faction, allies, allegiance, doctrine — with the army-wide
 * pickers (Rite of War, Household Paradigm, sub-faction), all changeable at
 * any time. Inline in the desktop header; a panel above the cards on phones.
 */

import React from 'react';
import { useRosterStore, selectPrimaryFaction } from '../../store/rosterStore';
import { factionLabel } from '../../data/factions';
import { configOptions, doctrineLabel as labelOfDoctrine, normalizeDoctrine } from '../../rules/armyConfig';
import { armyChoiceLabel, rosterArmyChoiceGroups } from '../../rules/armyChoices';

const SELECT_STYLE: React.CSSProperties = {
  pointerEvents: 'auto',
  background: 'transparent',
  color: 'var(--cds-text-primary)',
  border: 'none',
  borderBottom: '1px solid var(--cds-border-strong-01)',
  fontSize: 13,
  padding: '2px 4px',
  cursor: 'pointer',
  maxWidth: 220,
};

const Dot = () => <span style={{ color: 'var(--cds-border-strong-01)' }}>·</span>;

export default function ArmySummary({ layout }: { layout: 'inline' | 'panel' }) {
  const faction = useRosterStore(selectPrimaryFaction);
  const allies = useRosterStore((s) => s.forces.filter((f) => f.kind === 'allied').map((f) => f.faction));
  const allegiance = useRosterStore((s) => s.allegiance);
  const cohortDoctrine = useRosterStore((s) => s.cohortDoctrine);
  const armyChoices = useRosterStore((s) => s.armyChoices);
  const setArmyChoice = useRosterStore((s) => s.setArmyChoice);
  const configChoices = useRosterStore((s) => s.configChoices);
  const setConfigChoice = useRosterStore((s) => s.setConfigChoice);
  const choiceGroups = rosterArmyChoiceGroups([faction, ...allies]);
  const settings = configOptions(faction);
  const doctrine = cohortDoctrine ? labelOfDoctrine(normalizeDoctrine(cohortDoctrine)) || null : null;

  const pickers = [
    // Army settings (Rite of War, Household Paradigm…)
    ...settings.map((o) => (
      <select
        key={o.name}
        aria-label={o.name}
        title={o.name}
        value={configChoices[o.name] ?? ''}
        onChange={(e) => setConfigChoice(o.name, e.target.value)}
        style={SELECT_STYLE}
      >
        {o.optional && (
          <option value="" style={{ color: 'initial' }}>
            {o.name}: none
          </option>
        )}
        {o.choices.map((c) => (
          <option key={c} value={c} style={{ color: 'initial' }}>
            {c}
          </option>
        ))}
      </select>
    )),
    // Army-wide sub-faction, applied to every unit on export
    ...choiceGroups.map((g) => (
      <select
        key={g.id}
        aria-label={armyChoiceLabel(g)}
        title={armyChoiceLabel(g)}
        value={armyChoices[g.id] ?? g.options[0]?.id ?? ''}
        onChange={(e) => setArmyChoice(g.id, e.target.value)}
        style={SELECT_STYLE}
      >
        {g.options.map((o) => (
          <option key={o.id} value={o.id} style={{ color: 'initial' }}>
            {o.name}
          </option>
        ))}
      </select>
    )),
  ];

  const facts = (
    <>
      <span>{factionLabel(faction)}</span>
      {allies.length > 0 && <span>+ {allies.map(factionLabel).join(' + ')}</span>}
      <Dot />
      <span>{allegiance}</span>
      {doctrine && (
        <>
          <Dot />
          <span>{doctrine}</span>
        </>
      )}
    </>
  );

  if (layout === 'panel') {
    return (
      <div
        style={{
          background: 'var(--cds-layer-01)',
          border: '1px solid var(--cds-border-subtle-01)',
          borderRadius: 4,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          color: 'var(--cds-text-secondary)',
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{facts}</div>
        {pickers.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{pickers}</div>}
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--cds-text-secondary)',
        fontSize: 13,
        gap: 8,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {facts}
      {pickers.map((p) => (
        <React.Fragment key={p.key}>
          <Dot />
          {p}
        </React.Fragment>
      ))}
    </div>
  );
}
