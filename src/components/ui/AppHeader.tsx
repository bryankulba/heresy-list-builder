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

export type AppView = 'canvas' | 'list';

interface AppHeaderProps {
  onExport: () => void;
  hasWarlord: boolean;
  onAddWarlord: () => void;
  onAddLordOfWar: () => void;
  view: AppView;
  onViewChange: (v: AppView) => void;
}

export default function AppHeader({ onExport, hasWarlord, onAddWarlord, onAddLordOfWar, view, onViewChange }: AppHeaderProps) {
  const faction = useRosterStore((s) => s.faction);
  const allegiance = useRosterStore((s) => s.allegiance);
  const reset = useRosterStore((s) => s.reset);

  const factionLabel = FACTION_LABEL_MAP[faction] ?? faction;

  const toggleBtn = (label: string, v: AppView) => (
    <button
      onClick={() => onViewChange(v)}
      style={{
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: 500,
        border: '1px solid var(--cds-border-strong-01)',
        background: view === v ? 'var(--cds-background-selected)' : 'transparent',
        color: view === v ? 'var(--cds-text-primary)' : 'var(--cds-text-secondary)',
        cursor: 'pointer',
        borderRadius: v === 'canvas' ? '3px 0 0 3px' : '0 3px 3px 0',
        borderRight: v === 'canvas' ? 'none' : undefined,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      {label}
    </button>
  );

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
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 8 }}>
        {toggleBtn('Canvas', 'canvas')}
        {toggleBtn('List', 'list')}
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
