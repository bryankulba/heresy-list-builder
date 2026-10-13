import React, { useRef, useState } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  TextInput,
  Button,
} from '@carbon/react';
import { useRosterStore, computeTotalPoints } from '../../store/rosterStore';
import { getAllSaves, saveList, deleteSave, canSaveMore, SAVE_LIMIT } from '../../utils/savedLists';
import { factionLabel } from '../../data/factions';
import type { SavedList } from '../../types';
import { importRos, type ImportResult } from '../../utils/importRos';
import ConfirmModal from './ConfirmModal';

interface SavedListsModalProps {
  onClose: () => void;
}

/** "Death Guard + Mechanicum" — primary army first, then allies. */
function describeForces(factions: string[]): string {
  // A Lord of War Detachment is the same faction as the army
  return [...new Set(factions)].map(factionLabel).join(' + ');
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SavedListsModal({ onClose }: SavedListsModalProps) {
  const phase = useRosterStore((s) => s.phase);
  const allegiance = useRosterStore((s) => s.allegiance);
  const pointsLimit = useRosterStore((s) => s.pointsLimit);
  const cohortDoctrine = useRosterStore((s) => s.cohortDoctrine);
  const armyChoices = useRosterStore((s) => s.armyChoices);
  const forces = useRosterStore((s) => s.forces);
  const loadSave = useRosterStore((s) => s.loadSave);

  const [saves, setSaves] = useState<SavedList[]>(() => getAllSaves());
  const [listName, setListName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingLoadItem, setPendingLoadItem] = useState<SavedList | null>(null);
  const [pendingImport, setPendingImport] = useState<{ fileName: string; result: ImportResult } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleImportFile(file: File) {
    setImportError(null);
    try {
      const result = importRos(await file.text());
      if (result.snapshot.forces.length === 0) {
        setImportError(`Nothing in "${file.name}" could be imported. ${result.warnings.join(' ')}`);
        return;
      }
      setPendingImport({ fileName: file.name, result });
    } catch (e) {
      setImportError(`"${file.name}" couldn't be read as a .ros roster (${(e as Error).message}).`);
    }
  }

  function handleImportConfirmed() {
    if (!pendingImport) return;
    loadSave(pendingImport.result.snapshot);
    setPendingImport(null);
    onClose();
  }

  const totalPoints = computeTotalPoints(forces);
  const currentLabel = describeForces(forces.map((f) => f.faction));
  const atLimit = !canSaveMore();

  function refreshSaves() {
    setSaves(getAllSaves());
  }

  function handleSave() {
    if (!listName.trim() || atLimit) return;
    saveList({ allegiance, pointsLimit, cohortDoctrine, armyChoices, forces }, listName.trim());
    setListName('');
    refreshSaves();
  }

  function handleDeleteConfirmed() {
    if (!pendingDeleteId) return;
    deleteSave(pendingDeleteId);
    setPendingDeleteId(null);
    refreshSaves();
  }

  function handleLoadConfirmed() {
    if (!pendingLoadItem) return;
    loadSave(pendingLoadItem);
    setPendingLoadItem(null);
    onClose();
  }

  function handleLoadClick(item: SavedList) {
    if (phase === 'canvas') {
      setPendingLoadItem(item);
    } else {
      loadSave(item);
      onClose();
    }
  }

  return (
    <>
      <ComposedModal open onClose={onClose} size="sm">
        <ModalHeader title="Saved Lists" />
        <ModalBody hasForm>
          {/* Save current list */}
          {phase === 'canvas' && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: 'var(--cds-text-secondary)', marginBottom: 8 }}>
                Current list: <strong style={{ color: 'var(--cds-text-primary)' }}>{currentLabel}</strong>
                {' · '}{allegiance}{' · '}{totalPoints}/{pointsLimit}pts
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <TextInput
                    id="save-list-name"
                    labelText="Save current list as"
                    placeholder="e.g. 3k Death Guard Tournament"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                    disabled={atLimit}
                  />
                  {atLimit && (
                    <p style={{ fontSize: 12, color: 'var(--cds-text-error)', marginTop: 4 }}>
                      Maximum {SAVE_LIMIT} lists saved. Delete one to save a new list.
                    </p>
                  )}
                </div>
                <Button
                  kind="primary"
                  size="md"
                  onClick={handleSave}
                  disabled={!listName.trim() || atLimit}
                  style={{ flexShrink: 0, marginBottom: atLimit ? 20 : 0 }}
                >
                  Save
                </Button>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--cds-border-subtle-01)', margin: '20px 0 0' }} />
            </div>
          )}

          {/* Saved list rows */}
          {saves.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--cds-text-secondary)', padding: '8px 0' }}>
              No saved lists yet. Build a list and save it here.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {saves.map((item) => {
                const itemFactionLabel = describeForces(item.forces.map((f) => f.faction));
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      background: 'var(--cds-layer-02)',
                      borderRadius: 2,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cds-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--cds-text-secondary)', marginTop: 2 }}>
                        {itemFactionLabel} · {item.allegiance} · {item.pointsLimit}pts · {formatDate(item.savedAt)}
                      </div>
                    </div>
                    <Button kind="ghost" size="sm" onClick={() => handleLoadClick(item)}>
                      Load
                    </Button>
                    <Button
                      kind="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(item.id)}
                      style={{ color: 'var(--cds-button-danger-primary)' }}
                    >
                      Delete
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Import a roster from New Recruit / BattleScribe */}
          <hr style={{ border: 'none', borderTop: '1px solid var(--cds-border-subtle-01)', margin: '20px 0 16px' }} />
          <p style={{ fontSize: 13, color: 'var(--cds-text-secondary)', marginBottom: 8 }}>
            Open a roster exported from New Recruit or BattleScribe (.ros). Detachments, units and Prime
            benefits come across; unit wargear choices don't.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".ros,application/xml,text/xml"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
          <Button kind="tertiary" size="md" onClick={() => fileInput.current?.click()}>
            Import .ros…
          </Button>
          {importError && (
            <p style={{ fontSize: 12, color: 'var(--cds-text-error)', marginTop: 8 }}>{importError}</p>
          )}
        </ModalBody>
      </ComposedModal>

      {pendingImport && (
        <ConfirmModal
          message={[
            `Load "${pendingImport.fileName}"${phase === 'canvas' ? '? This will replace your current list.' : '?'}`,
            ...pendingImport.result.warnings.map((w) => `• ${w}`),
          ].join('\n')}
          primaryButtonText="Load"
          onConfirm={handleImportConfirmed}
          onClose={() => setPendingImport(null)}
        />
      )}

      {pendingDeleteId && (
        <ConfirmModal
          message={`Delete "${saves.find((s) => s.id === pendingDeleteId)?.name}"? This cannot be undone.`}
          primaryButtonText="Delete"
          onConfirm={handleDeleteConfirmed}
          onClose={() => setPendingDeleteId(null)}
        />
      )}

      {pendingLoadItem && (
        <ConfirmModal
          message={`Load "${pendingLoadItem.name}"? This will replace your current list.`}
          primaryButtonText="Load"
          onConfirm={handleLoadConfirmed}
          onClose={() => setPendingLoadItem(null)}
        />
      )}
    </>
  );
}
