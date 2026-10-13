import React from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  Button,
} from '@carbon/react';
import { Export, Reset, Add, Save } from '@carbon/icons-react';
import { useRosterStore, selectPrimaryFaction } from '../../store/rosterStore';
import { factionLabel } from '../../data/factions';
import { COHORT_DOCTRINE_BY_ID } from '../../constants/cohortDoctrines';
import { armyChoiceLabel, rosterArmyChoiceGroups } from '../../rules/armyChoices';

interface AppHeaderProps {
  onExport: () => void;
  onSaveLoad: () => void;
  onNewList: () => void;
  /** Shown when the army can add a Warlord Detachment and hasn't yet */
  onAddWarlord?: () => void;
  /** Shown when the army may take Allied Detachments */
  onAddAllies?: () => void;
  /** Shown when the army may add a Lord of War Detachment and hasn't yet */
  onAddLordOfWar?: () => void;
  /** Shown when the army's chart has freely-added detachments (e.g. Knight talons) */
  onAddDetachment?: () => void;
}

export default function AppHeader({
  onExport,
  onSaveLoad,
  onNewList,
  onAddWarlord,
  onAddAllies,
  onAddLordOfWar,
  onAddDetachment,
}: AppHeaderProps) {
  const faction = useRosterStore(selectPrimaryFaction);
  const allies = useRosterStore((s) => s.forces.filter((f) => f.kind === 'allied').map((f) => f.faction));
  const allegiance = useRosterStore((s) => s.allegiance);
  const cohortDoctrine = useRosterStore((s) => s.cohortDoctrine);
  const armyChoices = useRosterStore((s) => s.armyChoices);
  const setArmyChoice = useRosterStore((s) => s.setArmyChoice);
  const choiceGroups = rosterArmyChoiceGroups([faction, ...allies]);

  const doctrineLabel = cohortDoctrine ? COHORT_DOCTRINE_BY_ID[cohortDoctrine]?.name : null;

  return (
    <Header aria-label="Heresy List Builder">
      <HeaderName href="#" prefix="">
        Heresy List Builder
      </HeaderName>

      {/* Center: faction + allegiance */}
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
        <span>{factionLabel(faction)}</span>
        {allies.length > 0 && <span>+ {allies.map(factionLabel).join(' + ')}</span>}
        <span style={{ color: 'var(--cds-border-strong-01)' }}>·</span>
        <span>{allegiance}</span>
        {doctrineLabel && (
          <>
            <span style={{ color: 'var(--cds-border-strong-01)' }}>·</span>
            <span>{doctrineLabel}</span>
          </>
        )}
        {/* Army-wide sub-faction: changeable at any time, applied to every unit on export */}
        {choiceGroups.map((g) => (
          <React.Fragment key={g.id}>
            <span style={{ color: 'var(--cds-border-strong-01)' }}>·</span>
            <select
              aria-label={armyChoiceLabel(g)}
              title={armyChoiceLabel(g)}
              value={armyChoices[g.id] ?? g.options[0]?.id ?? ''}
              onChange={(e) => setArmyChoice(g.id, e.target.value)}
              style={{
                pointerEvents: 'auto',
                background: 'transparent',
                color: 'var(--cds-text-primary)',
                border: 'none',
                borderBottom: '1px solid var(--cds-border-strong-01)',
                fontSize: 13,
                padding: '2px 4px',
                cursor: 'pointer',
              }}
            >
              {g.options.map((o) => (
                <option key={o.id} value={o.id} style={{ color: 'initial' }}>
                  {o.name}
                </option>
              ))}
            </select>
          </React.Fragment>
        ))}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 8 }}>
        {onAddWarlord && (
          <Button kind="ghost" size="sm" renderIcon={Add} onClick={onAddWarlord}>
            Add Warlord
          </Button>
        )}
        {onAddLordOfWar && (
          <Button kind="ghost" size="sm" renderIcon={Add} onClick={onAddLordOfWar}>
            Add Lord of War
          </Button>
        )}
        {onAddDetachment && (
          <Button kind="ghost" size="sm" renderIcon={Add} onClick={onAddDetachment}>
            Add Detachment
          </Button>
        )}
        {onAddAllies && (
          <Button kind="ghost" size="sm" renderIcon={Add} onClick={onAddAllies}>
            Add Allies
          </Button>
        )}
      </div>

      <HeaderGlobalBar>
        <HeaderGlobalAction
          aria-label="Save / load lists"
          tooltipAlignment="end"
          onClick={onSaveLoad}
        >
          <Save size={20} />
        </HeaderGlobalAction>
        <HeaderGlobalAction
          aria-label="Export list"
          tooltipAlignment="end"
          onClick={onExport}
        >
          <Export size={20} />
        </HeaderGlobalAction>
        <HeaderGlobalAction
          aria-label="New list"
          tooltipAlignment="end"
          onClick={onNewList}
        >
          <Reset size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  );
}
