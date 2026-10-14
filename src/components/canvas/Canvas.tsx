/**
 * Canvas.tsx
 * The card table: header actions, the pannable / zoomable canvas of detachment
 * cards with connector lines, the points card, and the modals. Logic lives in
 * hooks: useRosterView (derived roster data), useSlotFlow (the modal state
 * machine), useCanvasViewport (pan / zoom / drag), useConnections (lines).
 */

import React from 'react';
import type { Force, PlacedDetachment } from '../../types';
import { useRosterStore, computeTotalPoints } from '../../store/rosterStore';
import { primaryForce } from '../../store/rosterModel';
import { getAdditionalDetachments, getAllyFactions, getChart, lordOfWarChartFor } from '../../data/loader';
import { CRUSADE_CHART, factionLabel } from '../../data/factions';
import { detachmentAllowances } from '../../rules/detachmentLimits';
import { compulsorySlotsFillable } from '../../rules/options';
import DetachmentCard from './DetachmentCard';
import ConnectorLine from './ConnectorLine';
import CanvasModals from './CanvasModals';
import AppHeader from '../ui/AppHeader';
import PointsCard from '../ui/PointsCard';
import { CANVAS_H, CANVAS_W, CARD_W, computeCardPositions, computeInstanceNumbers, type CardPosition } from './canvasLayout';
import { useCanvasViewport } from './useCanvasViewport';
import { useConnections } from './useConnections';
import { useRosterView } from './useRosterView';
import { useSlotFlow } from './useSlotFlow';
import StackedView from './StackedView';
import { useIsCompactHeader, useIsPhone } from '../ui/useIsPhone';

export default function Canvas() {
  const roster = useRosterView();
  const { forces, detachments, counts, view, warnings, warningsByDetachment, pointsLimit } = roster;
  const flow = useSlotFlow(roster);
  const { setModal } = flow;
  const viewport = useCanvasViewport();
  const { pan, zoom, positionOverrides, draggingId } = viewport;
  const { innerRef, connections, cardRefCallback, slotRefCallback } = useConnections(detachments, zoom, [pan, positionOverrides]);

  const addDetachment = useRosterStore((s) => s.addDetachment);
  const addLordOfWar = useRosterStore((s) => s.addLordOfWar);
  const removeForce = useRosterStore((s) => s.removeForce);
  const removeDetachment = useRosterStore((s) => s.removeDetachment);

  const primary = primaryForce(forces);
  const totalPoints = computeTotalPoints(forces);

  // Header actions depend on the primary army's chart and rules
  // Only for armies with a unit BSData lets fill its Warlord slot (not Mechanicum, Solar Auxilia…)
  const warlordCandidate =
    primary?.chart === CRUSADE_CHART && !primary.detachments.some((d) => d.def.name === 'Warlord Detachment')
      ? getChart(CRUSADE_CHART).detachments.find(
          (d) => d.name === 'Warlord Detachment' && (!d.sources?.length || d.sources.includes(primary.faction))
        )
      : undefined;
  const warlordDef =
    warlordCandidate && primary && compulsorySlotsFillable(forces, primary, warlordCandidate, counts)
      ? warlordCandidate
      : undefined;
  const additionalDetachments = primary ? getAdditionalDetachments(primary.chart, primary.faction) : [];
  const allyFactions = primary ? getAllyFactions(primary.faction) : [];
  // One Lord of War Detachment per army (Knights use their own "Knight Lord of War" chart)
  const canAddLordOfWar = !!primary && !forces.some((f) => f.kind === 'lordOfWar') && !!lordOfWarChartFor(primary.faction);

  /**
   * Remove action for a card, if it can be removed on its own: an allied army
   * or Lord of War Detachment (from its root card), the Warlord Detachment,
   * and freely-added detachments. Asks first when units would be lost.
   */
  function removeActionFor(force: Force, det: PlacedDetachment): (() => void) | undefined {
    const hasUnits = (dets: PlacedDetachment[]) => dets.some((d) => Object.values(d.slots).some(Boolean));
    if (force.kind !== 'primary' && det.id === force.detachments[0]?.id) {
      return () =>
        hasUnits(force.detachments) ? setModal({ type: 'confirmRemoveForce', forceId: force.id }) : removeForce(force.id);
    }
    if (det.def.type === 'additional' || det.def.name === 'Warlord Detachment') {
      // The detachment and anything its slots unlocked
      const affected = detachments.filter((d) => d.id === det.id || d.unlockedBy?.startsWith(`${det.id}::`));
      return () =>
        hasUnits(affected) ? setModal({ type: 'confirmRemoveDetachment', detachmentId: det.id }) : removeDetachment(det.id);
    }
    return undefined;
  }

  const isPhone = useIsPhone();
  const compactHeader = useIsCompactHeader();
  const pointsCard = (
    <PointsCard
      current={totalPoints}
      limit={pointsLimit}
      warnings={warnings}
      variant={isPhone ? 'bar' : 'card'}
      allowances={
        primary
          ? detachmentAllowances(forces, primary, counts)
              // Allowances the army builds up (Auxiliary, Apex); a fixed cap (one Zone
              // Mortalis primary) only when it's broken
              .filter((a) => (a.max > 0 || a.used > 0) && (a.adjustable || a.used > a.max))
              .map((a) => ({ label: a.name.replace(/ Detachment\(s\)$|s$/, ''), used: a.used, max: a.max }))
          : []
      }
    />
  );
  const header = (
    <AppHeader
      compact={compactHeader}
      showSummary={!isPhone}
      onExport={() => setModal({ type: 'export' })}
      onSaveLoad={() => setModal({ type: 'saveLoad' })}
      onNewList={() => setModal({ type: 'confirmReset' })}
      onAddWarlord={warlordDef && primary ? () => addDetachment(warlordDef, { forceId: primary.id }) : undefined}
      onAddAllies={allyFactions.length > 0 ? () => setModal({ type: 'allySelector' }) : undefined}
      onAddLordOfWar={canAddLordOfWar ? addLordOfWar : undefined}
      onAddDetachment={
        additionalDetachments.length > 0 ? () => setModal({ type: 'additionalDetachmentSelector' }) : undefined
      }
    />
  );
  const modals = (
    <CanvasModals
      roster={roster}
      flow={flow}
      primary={primary}
      additionalDetachments={additionalDetachments}
      allyFactions={allyFactions}
      totalPoints={totalPoints}
    />
  );
  const instanceNumbers = computeInstanceNumbers(detachments);
  // Phones and tablets: an open modal is a drawer that pushes the page aside
  // (index.scss .app-stage--pushed); the modals sit outside the stage so they don't move with it
  const stageClass = `app-stage${flow.modal.type !== 'none' ? ' app-stage--pushed' : ''}`;

  // Phones: the same cards in one scrolling column
  if (isPhone) {
    return (
      <div style={{ height: '100dvh', overflow: 'hidden' }}>
        <div className={stageClass}>
        {header}
        <StackedView
          view={view}
          instanceNumbers={instanceNumbers}
          warningsByDetachment={warningsByDetachment}
          removeActionFor={removeActionFor}
          onSlotClick={flow.handleSlotClick}
          onSlotClear={flow.handleSlotClear}
          bottomInset={warnings.length > 0 ? 96 : 68}
        />
        {pointsCard}
        </div>
        {modals}
      </div>
    );
  }

  const { positions: cardPositions, labels: forceLabels } = computeCardPositions(view);
  // A dragged card's position overrides the computed layout
  const getCardPos = (detId: string): CardPosition => positionOverrides[detId] ?? cardPositions.get(detId) ?? { x: 0, y: 0 };

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <div className={stageClass}>
      {header}

      {/* Canvas area */}
      <div
        ref={viewport.outerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: draggingId ? 'grabbing' : 'grab',
          background: 'var(--cds-background)',
          // Panning across cards shouldn't select their text
          userSelect: 'none',
          WebkitUserSelect: 'none',
          // Touch gestures are the canvas's own (pan / pinch), not the browser's
          touchAction: 'none',
        }}
        {...viewport.viewportHandlers}
      >
        {/* Pannable + zoomable inner canvas */}
        <div
          ref={innerRef}
          style={{
            position: 'relative',
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG connector overlay */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {connections.map((conn) => (
              <ConnectorLine key={conn.id} from={conn.from} to={conn.to} />
            ))}
          </svg>

          {/* Allied / Lord of War army labels */}
          {forceLabels.map((label) => (
            <div
              key={label.forceId}
              style={{
                position: 'absolute',
                left: label.x,
                top: label.y,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--cds-support-info)',
                pointerEvents: 'none',
              }}
            >
              {label.text}
            </div>
          ))}

          {/* Detachment cards */}
          {view.flatMap((force) => force.detachments.map((det) => ({ force, det }))).map(({ force, det }) => {
            const pos = getCardPos(det.id);
            const isDragging = draggingId === det.id;
            return (
              <div
                key={det.id}
                data-no-pan
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  width: CARD_W,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  outline: isDragging ? '2px solid var(--cds-focus)' : undefined,
                  outlineOffset: isDragging ? 2 : undefined,
                  boxShadow: isDragging ? '0 8px 32px rgba(0,0,0,0.5)' : undefined,
                  zIndex: isDragging ? 10 : undefined,
                  transition: isDragging ? undefined : 'box-shadow 0.15s, outline 0.15s',
                }}
                onPointerDown={(e) => viewport.handleCardPointerDown(e, det.id, pos)}
              >
                <DetachmentCard
                  detachment={det}
                  instanceNumber={instanceNumbers.get(det.id)}
                  allyFaction={force.kind === 'allied' ? factionLabel(force.faction) : undefined}
                  warnings={warningsByDetachment.get(det.id)}
                  onRemove={removeActionFor(force, det)}
                  onSlotClick={(slotKey, slotDef) => flow.handleSlotClick(det.id, slotKey, slotDef)}
                  onSlotClear={(slotKey) => flow.handleSlotClear(det.id, slotKey)}
                  cardRef={cardRefCallback(det.id)}
                  slotRefCallback={(slotKey) => slotRefCallback(det.id)(slotKey)}
                />
              </div>
            );
          })}
        </div>

        {/* Zoom indicator — click to reset */}
        <button
          data-no-pan
          onClick={viewport.resetView}
          title="Reset zoom (or double-click canvas)"
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 500,
            background: 'var(--cds-layer-01)',
            border: '1px solid var(--cds-border-strong-01)',
            color: 'var(--cds-text-secondary)',
            borderRadius: 4,
            cursor: 'pointer',
            opacity: zoom === 1 ? 0.5 : 1,
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>

      {pointsCard}
      </div>
      {modals}
    </div>
  );
}
