/**
 * StackedView.tsx
 * The phone layout: the same cards as the canvas in one scrolling column —
 * each army in turn, its root detachment (and Warlord) first, then every
 * detachment directly under the one whose slot unlocked it, tagged with the
 * unit that unlocked it (the canvas draws a connector line instead). A strip
 * of detachment names stays under the header to jump between them.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { Force, PlacedDetachment, SlotDef } from '../../types';
import { factionLabel } from '../../data/factions';
import { getDetachmentDisplayName } from '../../data/loader';
import { SAFE } from '../ui/PointsCard';
import type { RosterWarning } from '../../rules/validate';
import DetachmentCard from './DetachmentCard';
import ArmySummary from '../ui/ArmySummary';

interface StackedViewProps {
  view: Force[];
  instanceNumbers: Map<string, number | undefined>;
  warningsByDetachment: Map<string, RosterWarning[]>;
  removeActionFor: (force: Force, det: PlacedDetachment) => (() => void) | undefined;
  onSlotClick: (detachmentId: string, slotKey: string, slotDef: SlotDef) => void;
  onSlotClear: (detachmentId: string, slotKey: string) => void;
  /** Space kept clear at the bottom for the points bar */
  bottomInset: number;
  /** Detachments a slot's unit may still unlock ("detId::slotKey" → how many) */
  pendingUnlocks?: Map<string, number>;
}

/** A force's detachments in reading order, with the unit that unlocked each (if any). */
export function stackedOrder(force: Force): Array<{ det: PlacedDetachment; unlockedBy?: string; depth: number }> {
  const out: Array<{ det: PlacedDetachment; unlockedBy?: string; depth: number }> = [];
  const placed = new Set<string>();
  const unlockedFrom = (det: PlacedDetachment) =>
    force.detachments.filter((d) => d.unlockedBy?.startsWith(`${det.id}::`) && !placed.has(d.id));
  const unitAt = (ref: string) => {
    const [detId, slotKey] = ref.split('::');
    return force.detachments.find((d) => d.id === detId)?.slots[slotKey]?.unit.name;
  };
  const visit = (det: PlacedDetachment, depth: number) => {
    if (placed.has(det.id)) return;
    placed.add(det.id);
    out.push({ det, depth, ...(det.unlockedBy ? { unlockedBy: unitAt(det.unlockedBy) } : {}) });
    for (const child of unlockedFrom(det)) visit(child, depth + 1);
  };
  const [root, ...rest] = force.detachments;
  if (root) visit(root, 0);
  const warlord = rest.find((d) => d.def.name === 'Warlord Detachment');
  if (warlord) visit(warlord, 0);
  // Anything not reached from a slot (Additional detachments, unlinked imports)
  for (const det of rest) visit(det, 0);
  return out;
}

const HEADER_H = 48;
const STRIP_H = 44;
/** The list's top padding: clear of the fixed header */
const PAD_TOP = HEADER_H + 16;
const cardDomId = (detId: string) => `stack-${detId}`;

/** Sticky chips naming each detachment; tap to scroll to it, the one in view is highlighted. */
function JumpStrip({
  items,
  activeId,
  onJump,
}: {
  items: Array<{ id: string; label: string; warn: boolean }>;
  activeId: string | undefined;
  onJump: (id: string) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  // Keep the highlighted chip in view as the list scrolls
  useEffect(() => {
    const strip = stripRef.current;
    const chip = activeId ? strip?.querySelector<HTMLElement>(`[data-chip="${activeId}"]`) : null;
    if (strip && chip) {
      const left = chip.offsetLeft - 12;
      const right = chip.offsetLeft + chip.offsetWidth + 12 - strip.clientWidth;
      if (strip.scrollLeft > left) strip.scrollTo({ left, behavior: 'smooth' });
      else if (strip.scrollLeft < right) strip.scrollTo({ left: right, behavior: 'smooth' });
    }
  }, [activeId]);

  return (
    <div
      ref={stripRef}
      style={{
        position: 'sticky',
        // Sticky offsets count from inside the list's padding; stick right under the header
        top: HEADER_H - PAD_TOP,
        zIndex: 5,
        height: STRIP_H,
        flexShrink: 0,
        margin: '-4px -12px 0',
        padding: '6px 12px',
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        background: 'var(--cds-background)',
        borderBottom: '1px solid var(--cds-border-subtle-01)',
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            data-chip={item.id}
            onClick={() => onJump(item.id)}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 12px',
              borderRadius: 16,
              fontSize: 13,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: `1px solid ${active ? 'var(--cds-border-interactive)' : 'var(--cds-border-subtle-01)'}`,
              background: active ? 'var(--cds-layer-selected-01)' : 'var(--cds-layer-01)',
              color: active ? 'var(--cds-text-primary)' : 'var(--cds-text-secondary)',
            }}
          >
            {item.warn && (
              <span
                aria-label="has warnings"
                style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--cds-support-error)' }}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function StackedView({
  view,
  instanceNumbers,
  warningsByDetachment,
  removeActionFor,
  onSlotClick,
  onSlotClear,
  bottomInset,
  pendingUnlocks,
}: StackedViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const ordered = view.map((force) => ({ force, rows: stackedOrder(force) }));
  const chips = ordered.flatMap(({ force, rows }) =>
    rows.map(({ det }) => {
      const n = instanceNumbers.get(det.id);
      const name = getDetachmentDisplayName(det.def.name);
      return {
        id: det.id,
        label: (force.kind === 'allied' ? `${factionLabel(force.faction)}: ` : '') + (n != null ? `${name} #${n}` : name),
        warn: (warningsByDetachment.get(det.id)?.length ?? 0) > 0,
      };
    })
  );

  // The card nearest the top of the list (just under the strip) is the active chip
  const [activeId, setActiveId] = useState<string | undefined>(chips[0]?.id);
  const chipKey = chips.map((c) => c.id).join('|');
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const update = () => {
      const top = root.getBoundingClientRect().top + HEADER_H + STRIP_H + 16;
      let current = chips[0]?.id;
      for (const c of chips) {
        const el = document.getElementById(cardDomId(c.id));
        if (el && el.getBoundingClientRect().top <= top) current = c.id;
      }
      // Scrolled to the end: the last card counts even if it never reaches the top
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) current = chips[chips.length - 1]?.id;
      setActiveId(current);
    };
    update();
    root.addEventListener('scroll', update, { passive: true });
    return () => root.removeEventListener('scroll', update);
  }, [chipKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = (id: string) => document.getElementById(cardDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--cds-background)',
        padding: `${PAD_TOP}px calc(12px + ${SAFE.right}) calc(${bottomInset + 16}px + ${SAFE.bottom}) calc(12px + ${SAFE.left})`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <ArmySummary layout="panel" />
      {chips.length > 1 && <JumpStrip items={chips} activeId={activeId} onJump={jump} />}

      {ordered.map(({ force, rows }) => (
        <React.Fragment key={force.id}>
          {force.kind !== 'primary' && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--cds-support-info)',
              }}
            >
              {force.kind === 'allied' ? `Allies — ${factionLabel(force.faction)}` : 'Lord of War'}
            </div>
          )}
          {rows.map(({ det, unlockedBy, depth }) => (
            <div
              key={det.id}
              id={cardDomId(det.id)}
              // Land below the header and the strip when jumped to
              style={{ paddingLeft: Math.min(depth, 2) * 8, scrollMarginTop: HEADER_H + STRIP_H + 8 }}
            >
              {unlockedBy && (
                <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', margin: '0 0 4px 2px' }}>
                  ↳ Unlocked by {unlockedBy}
                </div>
              )}
              <DetachmentCard
                detachment={det}
                instanceNumber={instanceNumbers.get(det.id)}
                allyFaction={force.kind === 'allied' ? factionLabel(force.faction) : undefined}
                warnings={warningsByDetachment.get(det.id)}
                onRemove={removeActionFor(force, det)}
                onSlotClick={(slotKey, slotDef) => onSlotClick(det.id, slotKey, slotDef)}
                onSlotClear={(slotKey) => onSlotClear(det.id, slotKey)}
                pendingUnlocks={(slotKey) => pendingUnlocks?.get(`${det.id}::${slotKey}`) ?? 0}
                fluid
              />
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
