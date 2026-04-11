import React, { useState, useMemo } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Search,
  Tag,
} from '@carbon/react';
import type { UnitEntry } from '../../types';
import { getUnitsForRole } from '../../data/loader';

interface UnitPickerModalProps {
  role: string;
  faction: string;
  onConfirm: (unit: UnitEntry) => void;
  onClose: () => void;
}

export default function UnitPickerModal({
  role,
  faction,
  onConfirm,
  onClose,
}: UnitPickerModalProps) {
  const [search, setSearch] = useState('');

  const units = useMemo(() => getUnitsForRole(faction, role), [faction, role]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return units;
    return units.filter((u) => u.name.toLowerCase().includes(q));
  }, [units, search]);

  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title={`Select ${role} Unit`} />
      <ModalBody hasForm>
        <Search
          id="unit-search"
          labelText="Search units"
          placeholder="Filter by name…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          size="sm"
          className="mb-4"
        />

        {filtered.length === 0 && (
          <p style={{ color: 'var(--cds-text-secondary)', fontSize: 14 }}>
            No units found for role "{role}".
          </p>
        )}

        <div
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {filtered.map((unit) => (
            <button
              key={unit.name}
              onClick={() => onConfirm(unit)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 2,
                border: '1px solid transparent',
                background: 'var(--cds-layer-02)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--cds-layer-hover-02)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--cds-layer-02)';
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: 'var(--cds-text-primary)',
                    fontSize: 14,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {unit.name}
                </div>
                <div style={{ color: 'var(--cds-text-secondary)', fontSize: 12, marginTop: 2 }}>
                  {unit.role}
                  {unit.source !== 'legiones-astartes' && (
                    <Tag type="purple" size="sm" style={{ marginLeft: 6 }}>
                      Legion
                    </Tag>
                  )}
                </div>
              </div>
              <div
                style={{
                  color: 'var(--cds-text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  marginLeft: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                {unit.points > 0 ? `${unit.points}pts` : 'Free'}
              </div>
            </button>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
