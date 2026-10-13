/**
 * StackedView.tsx
 * The phone layout: the same cards as the canvas in one scrolling column —
 * each army in turn, its root detachment (and Warlord) first, then every
 * detachment directly under the one whose slot unlocked it, tagged with the
 * unit that unlocked it (the canvas draws a connector line instead).
 */

import React from 'react';
import type { Force, PlacedDetachment, SlotDef } from '../../types';
import { factionLabel } from '../../data/factions';
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

export default function StackedView({
  view,
  instanceNumbers,
  warningsByDetachment,
  removeActionFor,
  onSlotClick,
  onSlotClear,
  bottomInset,
}: StackedViewProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--cds-background)',
        padding: `64px 12px ${bottomInset + 16}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <ArmySummary layout="panel" />

      {view.map((force) => (
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
          {stackedOrder(force).map(({ det, unlockedBy, depth }) => (
            <div key={det.id} style={{ paddingLeft: Math.min(depth, 2) * 8 }}>
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
                fluid
              />
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
