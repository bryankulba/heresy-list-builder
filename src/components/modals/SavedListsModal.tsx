import React, { useState } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  TextInput,
  Button,
} from '@carbon/react';
import { useRosterStore } from '../../store/rosterStore';
import { getAllSaves, saveList, deleteSave, canSaveMore, SAVE_LIMIT } from '../../utils/savedLists';
import { FACTION_LABEL_MAP } from '../../data/factions';
import { ROSTER_SCHEMA_VERSION } from '../../constants/schemaVersion';
import { computeTotalPoints } from '../../store/rosterStore';
import type { SavedList } from '../../types';
import ConfirmModal from './ConfirmModal';

interface SavedListsModalProps {
  onClose: () => void;
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
  const faction = useRosterStore((s) => s.faction);
  const allegiance = useRosterStore((s) => s.allegiance);
  const pointsLimit = useRosterStore((s) => s.pointsLimit);
  const cohortDoctrine = useRosterStore((s) => s.cohortDoctrine);
  const detachments = useRosterStore((s) => s.detachments);
  const loadSave = useRosterStore((s) => s.loadSave);

  const [saves, setSaves] = useState<SavedList[]>(() => getAllSaves());
  const [listName, setListName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingLoadItem, setPendingLoadItem] = useState<SavedList | null>(null);

  const totalPoints = computeTotalPoints(detachments);
  const factionLabel = FACTION_LABEL_MAP[faction] ?? faction;
  const atLimit = !canSaveMore();

  function refreshSaves() {
    setSaves(getAllSaves());
  }

  function handleSave() {
    if (!listName.trim() || atLimit) return;
    saveList({ faction, allegiance, pointsLimit, cohortDoctrine, detachments }, listName.trim());
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
                Current list: <strong style={{ color: 'var(--cds-text-primary)' }}>{factionLabel}</strong>
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
                const itemFactionLabel = FACTION_LABEL_MAP[item.faction] ?? item.faction;
                const isStale = item.schemaVersion !== ROSTER_SCHEMA_VERSION;
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
                        {isStale && (
                          <span
                            title="Saved with an older version of the app — unit stats may differ"
                            style={{ fontSize: 11, color: 'var(--cds-text-warning)', border: '1px solid var(--cds-border-strong-01)', borderRadius: 2, padding: '0 4px', flexShrink: 0 }}
                          >
                            outdated
                          </span>
                        )}
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
        </ModalBody>
      </ComposedModal>

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
