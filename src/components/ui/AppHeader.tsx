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

interface AppHeaderProps {
  onExport: () => void;
  onSaveLoad: () => void;
  onNewList: () => void;
  /** Shown when the army can add a Warlord Detachment and hasn't yet */
  onAddWarlord?: () => void;
  /** Shown when the army may take Allied Detachments */
  onAddAllies?: () => void;
  /** Shown when the army's chart has freely-added detachments (e.g. Knight talons) */
  onAddDetachment?: () => void;
}

export default function AppHeader({ onExport, onSaveLoad, onNewList, onAddWarlord, onAddAllies, onAddDetachment }: AppHeaderProps) {
  const faction = useRosterStore(selectPrimaryFaction);
  const allies = useRosterStore((s) => s.forces.filter((f) => f.kind === 'allied').map((f) => f.faction));
  const allegiance = useRosterStore((s) => s.allegiance);
  const cohortDoctrine = useRosterStore((s) => s.cohortDoctrine);

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
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 8 }}>
        {onAddWarlord && (
          <Button kind="ghost" size="sm" renderIcon={Add} onClick={onAddWarlord}>
            Add Warlord
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
