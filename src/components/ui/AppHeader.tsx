import React from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  Button,
} from '@carbon/react';
import { Export, Reset, Add } from '@carbon/icons-react';
import { useRosterStore } from '../../store/rosterStore';
import { FACTION_LABEL_MAP } from '../../data/factions';
import { COHORT_DOCTRINE_BY_ID } from '../../constants/cohortDoctrines';

interface AppHeaderProps {
  onExport: () => void;
  hasWarlord: boolean;
  onAddWarlord: () => void;
  onAddLordOfWar: () => void;
}

export default function AppHeader({ onExport, hasWarlord, onAddWarlord, onAddLordOfWar }: AppHeaderProps) {
  const faction = useRosterStore((s) => s.faction);
  const allegiance = useRosterStore((s) => s.allegiance);
  const cohortDoctrine = useRosterStore((s) => s.cohortDoctrine);
  const reset = useRosterStore((s) => s.reset);

  const factionLabel = FACTION_LABEL_MAP[faction] ?? faction;
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
        <span>{factionLabel}</span>
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
        {!hasWarlord && (
          <Button kind="ghost" size="sm" renderIcon={Add} onClick={onAddWarlord}>
            Add Warlord
          </Button>
        )}
        <Button kind="ghost" size="sm" renderIcon={Add} disabled>
          Add Lord of War
        </Button>
      </div>

      <HeaderGlobalBar>
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
          onClick={reset}
        >
          <Reset size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  );
}
