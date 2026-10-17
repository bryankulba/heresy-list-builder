/**
 * UnitReferenceModal.tsx
 * A cheat sheet of the army's units by battlefield role (header → Unit
 * reference): sizes, points and tags (Legion, Unique, one allegiance only, not
 * in Zone Mortalis). One tab per army when there are allies; a search box and
 * role chips to jump between sections.
 */

import React, { useMemo, useRef, useState } from 'react';
import { ComposedModal, ModalHeader, ModalBody, ModalFooter, Button, Search, Tag } from '@carbon/react';
import type { Allegiance, Force } from '../../types';
import { factionLabel } from '../../data/factions';
import { unitReference, type ReferenceUnit } from '../../rules/unitReference';

interface UnitReferenceModalProps {
  forces: Force[];
  allegiance: Allegiance;
  onClose: () => void;
}

const TAG_TYPE: Record<ReferenceUnit['tags'][number]['kind'], 'purple' | 'cyan' | 'magenta' | 'red' | 'teal'> = {
  legion: 'purple',
  unique: 'cyan',
  allegiance: 'magenta',
  banned: 'red',
  operative: 'teal',
};

const sectionId = (role: string) => `unit-ref-${role.replace(/\W+/g, '-')}`;

export default function UnitReferenceModal({ forces, allegiance, onClose }: UnitReferenceModalProps) {
  // One tab per army (the primary, then allies); a Lord of War Detachment fields the primary's units
  const armies = useMemo(
    () => forces.filter((f, i, all) => f.kind !== 'lordOfWar' && all.findIndex((g) => g.faction === f.faction) === i),
    [forces]
  );
  const [armyId, setArmyId] = useState(armies[0]?.id);
  const army = armies.find((f) => f.id === armyId) ?? armies[0];
  const [search, setSearch] = useState('');

  const groups = useMemo(() => (army ? unitReference(forces, army, allegiance) : []), [forces, army, allegiance]);
  const shown = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, units: g.units.filter((u) => u.unit.name.toLowerCase().includes(q)) }))
      .filter((g) => g.units.length > 0);
  }, [groups, search]);

  // Scroll the modal's body so the section sits just under the sticky search / chips
  const stickyRef = useRef<HTMLDivElement>(null);
  const jump = (role: string) => {
    const section = document.getElementById(sectionId(role));
    const scroller = section?.closest<HTMLElement>('.cds--modal-content');
    if (!section || !scroller) return;
    const offset = section.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const stickyHeight = stickyRef.current?.offsetHeight ?? 0;
    scroller.scrollTo({ top: scroller.scrollTop + offset - stickyHeight - 8, behavior: 'smooth' });
  };

  return (
    <ComposedModal open onClose={onClose} size="md">
      <ModalHeader title="Unit reference" label={army ? factionLabel(army.faction) : undefined} />
      <ModalBody>
        {/* Search, army tabs and role chips stay in view while the list scrolls */}
        <div
          ref={stickyRef}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            background: 'var(--cds-layer)',
            paddingBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {armies.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {armies.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  kind={f.id === army?.id ? 'primary' : 'tertiary'}
                  onClick={() => setArmyId(f.id)}
                >
                  {factionLabel(f.faction)}
                </Button>
              ))}
            </div>
          )}
          <Search
            id="unit-reference-search"
            labelText="Search units"
            placeholder="Filter by name…"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            size="sm"
          />
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
            {shown.map((g) => (
              <button
                key={g.role}
                onClick={() => jump(g.role)}
                style={{
                  flexShrink: 0,
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: '1px solid var(--cds-border-subtle-01)',
                  background: 'var(--cds-layer-02)',
                  color: 'var(--cds-text-secondary)',
                }}
              >
                {g.role} <span style={{ opacity: 0.7 }}>{g.units.length}</span>
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 && (
          <p style={{ color: 'var(--cds-text-secondary)', fontSize: 14 }}>No units match “{search}”.</p>
        )}

        {shown.map((g) => (
          <section key={g.role} id={sectionId(g.role)} style={{ marginBottom: 18 }}>
            <h4
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--cds-text-secondary)',
                paddingBottom: 4,
                marginBottom: 4,
                borderBottom: '1px solid var(--cds-border-subtle-01)',
              }}
            >
              {g.role} <span style={{ fontWeight: 400 }}>· {g.units.length}</span>
            </h4>
            {g.units.map(({ unit, size, fromPoints, tags }) => (
              <div
                key={unit.path ?? unit.name}
                style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '6px 2px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: 'var(--cds-text-primary)' }}>{unit.name}</span>
                  {tags.map((t) => (
                    <Tag key={t.label} type={TAG_TYPE[t.kind]} size="sm" style={{ marginLeft: 6, verticalAlign: 'middle' }}>
                      {t.label}
                    </Tag>
                  ))}
                  {size && <div style={{ fontSize: 12, color: 'var(--cds-text-secondary)' }}>{size}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cds-text-primary)', whiteSpace: 'nowrap' }}>
                  {fromPoints ? 'from ' : ''}
                  {unit.points}pts
                </div>
              </div>
            ))}
          </section>
        ))}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
