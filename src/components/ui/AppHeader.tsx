import React from 'react';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  Button,
  OverflowMenu,
  OverflowMenuItem,
} from '@carbon/react';
import { Export, Reset, Add, Save, Menu, Catalog } from '@carbon/icons-react';
import ArmySummary from './ArmySummary';

interface AppHeaderProps {
  onExport: () => void;
  onSaveLoad: () => void;
  onNewList: () => void;
  /** The army's units by battlefield role (cheat sheet) */
  onUnitReference: () => void;
  /** Shown when the army can add a Warlord Detachment and hasn't yet */
  onAddWarlord?: () => void;
  /** Shown when the army may take Allied Detachments */
  onAddAllies?: () => void;
  /** Shown when the army may add a Lord of War Detachment and hasn't yet */
  onAddLordOfWar?: () => void;
  /** Shown when the army's chart has freely-added detachments (e.g. Knight talons) */
  onAddDetachment?: () => void;
  /** Narrow screens: actions in a menu */
  compact?: boolean;
  /** With `compact`: keep the army line in the header (tablets; phones show it above the cards) */
  showSummary?: boolean;
}

export default function AppHeader({
  onExport,
  onSaveLoad,
  onNewList,
  onUnitReference,
  onAddWarlord,
  onAddAllies,
  onAddLordOfWar,
  onAddDetachment,
  compact = false,
  showSummary = false,
}: AppHeaderProps) {
  const addActions = [
    { label: 'Add Warlord', onClick: onAddWarlord },
    { label: 'Add Lord of War', onClick: onAddLordOfWar },
    { label: 'Add Detachment', onClick: onAddDetachment },
    { label: 'Add Allies', onClick: onAddAllies },
  ].filter((a): a is { label: string; onClick: () => void } => !!a.onClick);

  // Narrow screens: every action in one menu
  if (compact) {
    return (
      <Header aria-label="Heresy List Builder">
        <HeaderName href="#" prefix="" className="app-header__name">
          Heresy List Builder
        </HeaderName>
        {showSummary ? <ArmySummary layout="inline" /> : <div style={{ flex: 1 }} />}
        <HeaderGlobalBar style={{ flex: 'none' }}>
          <OverflowMenu
            aria-label="List actions"
            iconDescription="List actions"
            renderIcon={() => <Menu size={20} />}
            flipped
            size="lg"
            className="app-header__menu"
          >
            {addActions.map((a) => (
              <OverflowMenuItem key={a.label} itemText={a.label} onClick={a.onClick} />
            ))}
            <OverflowMenuItem itemText="Unit reference" onClick={onUnitReference} hasDivider={addActions.length > 0} />
            <OverflowMenuItem itemText="Save / load lists" onClick={onSaveLoad} />
            <OverflowMenuItem itemText="Export list" onClick={onExport} />
            <OverflowMenuItem itemText="New list" onClick={onNewList} isDelete />
          </OverflowMenu>
        </HeaderGlobalBar>
      </Header>
    );
  }

  return (
    <Header aria-label="Heresy List Builder">
      <HeaderName href="#" prefix="">
        Heresy List Builder
      </HeaderName>

      {/* Center: the army and its army-wide settings */}
      <ArmySummary layout="inline" />

      {/* Add buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 8 }}>
        {addActions.map((a) => (
          <Button key={a.label} kind="ghost" size="sm" renderIcon={Add} onClick={a.onClick}>
            {a.label}
          </Button>
        ))}
      </div>

      <HeaderGlobalBar>
        <HeaderGlobalAction aria-label="Unit reference" tooltipAlignment="end" onClick={onUnitReference}>
          <Catalog size={20} />
        </HeaderGlobalAction>
        <HeaderGlobalAction aria-label="Save / load lists" tooltipAlignment="end" onClick={onSaveLoad}>
          <Save size={20} />
        </HeaderGlobalAction>
        <HeaderGlobalAction aria-label="Export list" tooltipAlignment="end" onClick={onExport}>
          <Export size={20} />
        </HeaderGlobalAction>
        <HeaderGlobalAction aria-label="New list" tooltipAlignment="end" onClick={onNewList}>
          <Reset size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
    </Header>
  );
}
