import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { FilledSlot, ModalState, PlacedDetachment, SlotDef } from '../../types';
import { useRosterStore, computeTotalPoints } from '../../store/rosterStore';
import { detachmentsData, getBaseRole, stripPrimePrefix } from '../../data/loader';
import DetachmentCard, { expandSlots } from './DetachmentCard';
import ConnectorLine from './ConnectorLine';
import SlotEditModal from '../modals/SlotEditModal';
import UnitPickerModal from '../modals/UnitPickerModal';
import PrimeBenefitModal from '../modals/PrimeBenefitModal';
import BonusSlotRoleSelectorModal from '../modals/BonusSlotRoleSelectorModal';
import DetachmentSelectorModal from '../modals/DetachmentSelectorModal';
import ConfirmModal from '../modals/ConfirmModal';
import ExportModal from '../modals/ExportModal';
import AppHeader from '../ui/AppHeader';
import PointsCard from '../ui/PointsCard';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const CANVAS_W = 4000;
const CANVAS_H = 3000;
const CARD_W = 360;
const CARD_GAP = 24;
const CANVAS_ORIGIN_Y = 80;

// Primary card anchored top-left; everything else to its right
const PRIMARY_X = 24;
const RIGHT_X = PRIMARY_X + CARD_W + CARD_GAP * 2;   // start of the right section
const RIGHT_COL_STRIDE = CARD_W + CARD_GAP;           // 384 — distance between column starts
const RIGHT_COLS = 2;

// Estimated card heights used for row-stride calculations.
// These are generous so cards never overlap even when fully filled.
const APEX_ROW_H  = 560;
const AUX_ROW_H   = 520;
const SECTION_GAP = 64;  // vertical gap between the apex group and the aux group

interface CardPosition {
  x: number;
  y: number;
}

/** Compute absolute card positions on the canvas for each placed detachment. */
function computeCardPositions(
  detachments: PlacedDetachment[]
): Map<string, CardPosition> {
  const positions = new Map<string, CardPosition>();

  const primary    = detachments.find((d) => d.def.name === 'Crusade Primary Detachment');
  const warlord    = detachments.find((d) => d.def.name === 'Warlord Detachment');
  const apex       = detachments.filter((d) => d.unlockedBy && d.def.type === 'apex');
  const auxiliaries = detachments.filter((d) => d.unlockedBy && d.def.type === 'auxiliary');

  // Primary: left anchor
  if (primary) {
    positions.set(primary.id, { x: PRIMARY_X, y: CANVAS_ORIGIN_Y });
  }

  // Warlord: below primary in the same column
  if (warlord) {
    positions.set(warlord.id, {
      x: PRIMARY_X,
      y: CANVAS_ORIGIN_Y + APEX_ROW_H,
    });
  }

  // Apex: 2-column grid starting top-right
  apex.forEach((det, i) => {
    const col = i % RIGHT_COLS;
    const row = Math.floor(i / RIGHT_COLS);
    positions.set(det.id, {
      x: RIGHT_X + col * RIGHT_COL_STRIDE,
      y: CANVAS_ORIGIN_Y + row * APEX_ROW_H,
    });
  });

  // Auxiliary: 2-column grid below the apex group
  const apexRows = apex.length > 0 ? Math.ceil(apex.length / RIGHT_COLS) : 0;
  const auxStartY =
    CANVAS_ORIGIN_Y + apexRows * APEX_ROW_H + (apex.length > 0 ? SECTION_GAP : 0);

  auxiliaries.forEach((det, i) => {
    const col = i % RIGHT_COLS;
    const row = Math.floor(i / RIGHT_COLS);
    positions.set(det.id, {
      x: RIGHT_X + col * RIGHT_COL_STRIDE,
      y: auxStartY + row * AUX_ROW_H,
    });
  });

  return positions;
}

interface Connection {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Instance numbering
// ---------------------------------------------------------------------------
function computeInstanceNumbers(dets: PlacedDetachment[]): Map<string, number | undefined> {
  const countByName = new Map<string, number>();
  const result = new Map<string, number | undefined>();

  for (const d of dets) {
    const name = d.def.name;
    countByName.set(name, (countByName.get(name) ?? 0) + 1);
  }

  const seenByName = new Map<string, number>();
  for (const d of dets) {
    const name = d.def.name;
    if ((countByName.get(name) ?? 0) > 1) {
      const idx = (seenByName.get(name) ?? 0) + 1;
      seenByName.set(name, idx);
      result.set(d.id, idx);
    } else {
      result.set(d.id, undefined);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Canvas component
// ---------------------------------------------------------------------------
export default function Canvas() {
  const detachments = useRosterStore((s) => s.detachments);
  const faction = useRosterStore((s) => s.faction);
  const allegiance = useRosterStore((s) => s.allegiance);
  const pointsLimit = useRosterStore((s) => s.pointsLimit);
  const addDetachment = useRosterStore((s) => s.addDetachment);
  const fillSlot = useRosterStore((s) => s.fillSlot);
  const clearSlot = useRosterStore((s) => s.clearSlot);
  const addBonusSlot = useRosterStore((s) => s.addBonusSlot);
  const fillBonusSlot = useRosterStore((s) => s.fillBonusSlot);
  const clearBonusSlot = useRosterStore((s) => s.clearBonusSlot);
  const removeDetachment = useRosterStore((s) => s.removeDetachment);
  const clearBonusSlotsForSlot = useRosterStore((s) => s.clearBonusSlotsForSlot);
  const updateSlotAnnotations = useRosterStore((s) => s.updateSlotAnnotations);

  const totalPoints = computeTotalPoints(detachments);

  // ── Modal state ──
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  // Tracks if we need a second detachment selector (Officer of the Line)
  const pendingDoubleUnlock = useRef<string | null>(null);
  // Tracks when we're in edit mode so handlers return to slotEdit instead of chaining
  const isEditingSlot = useRef<{ detachmentId: string; slotKey: string } | null>(null);

  /** Find the SlotDef for a given slot key on a placed detachment. */
  function findSlotDef(detachmentId: string, slotKey: string): SlotDef | undefined {
    const det = detachments.find((d) => d.id === detachmentId);
    if (!det) return undefined;
    return expandSlots(det.def).find((s) => s.key === slotKey)?.slotDef;
  }

  /** After an edit action, return to the slotEdit modal with updated filled data. */
  function goBackToSlotEdit(detachmentId: string, slotKey: string, newFilled: FilledSlot) {
    isEditingSlot.current = null;
    const slotDef = findSlotDef(detachmentId, slotKey);
    if (slotDef) {
      setModal({ type: 'slotEdit', detachmentId, slotKey, slotDef, filled: newFilled });
    } else {
      setModal({ type: 'none' });
    }
  }

  // ── Pan + zoom state ──
  const [pan, setPan] = useState({ x: 16, y: 16 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
    isPanning.current = true;
    panStart.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y };
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    // Card drag takes priority
    if (dragState.current?.active) {
      const ds = dragState.current;
      const dx = (e.clientX - ds.startMouseX) / zoom;
      const dy = (e.clientY - ds.startMouseY) / zoom;
      setPositionOverrides((prev) => ({
        ...prev,
        [ds.detId]: { x: ds.startCardX + dx, y: ds.startCardY + dy },
      }));
      return;
    }

    // Cancel long-press if mouse moves too much before timer fires
    if (longPressTimer.current && dragState.current) {
      const ds = dragState.current;
      if (
        Math.abs(e.clientX - ds.startMouseX) > 5 ||
        Math.abs(e.clientY - ds.startMouseY) > 5
      ) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        dragState.current = null;
      }
    }

    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.mouseX;
    const dy = e.clientY - panStart.current.mouseY;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }

  function onMouseUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    dragState.current = null;
    setDraggingId(null);
    isPanning.current = false;
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.ctrlKey) {
      // Pinch gesture (trackpad) or ctrl+scroll → zoom centered on cursor
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      const newZoom = Math.max(0.2, Math.min(3, zoom * factor));
      const rect = outerRef.current!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      // Keep the canvas point under cursor fixed: newPan = mouse - (mouse - pan) / zoom * newZoom
      setPan({
        x: mouseX - ((mouseX - pan.x) / zoom) * newZoom,
        y: mouseY - ((mouseY - pan.y) / zoom) * newZoom,
      });
      setZoom(newZoom);
    } else {
      // Two-finger scroll or regular scroll → pan
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
    // Reset zoom and pan to default
    setZoom(1);
    setPan({ x: 16, y: 16 });
  }

  // ── Card drag state ──
  const [positionOverrides, setPositionOverrides] = useState<Record<string, CardPosition>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragState = useRef<{
    detId: string;
    startMouseX: number;
    startMouseY: number;
    startCardX: number;
    startCardY: number;
    active: boolean;
  } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCardMouseDown(e: React.MouseEvent, detId: string, pos: CardPosition) {
    // Don't initiate drag from interactive elements
    if ((e.target as HTMLElement).closest('button, input, select, [data-interactive]')) return;
    dragState.current = {
      detId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startCardX: pos.x,
      startCardY: pos.y,
      active: false,
    };
    longPressTimer.current = setTimeout(() => {
      if (dragState.current) {
        dragState.current.active = true;
        setDraggingId(detId);
      }
    }, 350);
  }

  // ── Refs for connector lines ──
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const outerRef = useRef<HTMLDivElement>(null);

  const cardRefCallback = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) cardRefs.current.set(id, el);
      else cardRefs.current.delete(id);
    },
    []
  );

  const slotRefCallback = useCallback(
    (detId: string) => (slotKey: string) => (el: HTMLDivElement | null) => {
      const key = `${detId}::${slotKey}`;
      if (el) slotRefs.current.set(key, el);
      else slotRefs.current.delete(key);
    },
    []
  );

  // ── Connector line computation ──
  const [connections, setConnections] = useState<Connection[]>([]);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!innerRef.current) return;
    const innerRect = innerRef.current.getBoundingClientRect();

    const newConns: Connection[] = [];
    for (const det of detachments) {
      if (!det.unlockedBy) continue;
      const cardEl = cardRefs.current.get(det.id);
      const slotEl = slotRefs.current.get(det.unlockedBy);
      if (!cardEl || !slotEl) continue;

      const cardRect = cardEl.getBoundingClientRect();
      const slotRect = slotEl.getBoundingClientRect();

      // getBoundingClientRect gives screen-space coords; divide by zoom to get canvas-local coords
      newConns.push({
        id: det.id,
        from: {
          x: (slotRect.left - innerRect.left + slotRect.width / 2) / zoom,
          y: (slotRect.bottom - innerRect.top) / zoom,
        },
        to: {
          x: (cardRect.left - innerRect.left + cardRect.width / 2) / zoom,
          y: (cardRect.top - innerRect.top) / zoom,
        },
      });
    }
    setConnections(newConns);
  }, [detachments, pan, zoom, positionOverrides]);

  // ── Slot interaction ──
  function handleSlotClick(detachmentId: string, slotKey: string, slotDef: SlotDef) {
    const filled = detachments.find((d) => d.id === detachmentId)?.slots[slotKey];
    if (filled) {
      setModal({ type: 'slotEdit', detachmentId, slotKey, slotDef, filled });
    } else {
      const matchableRole = getBaseRole(stripPrimePrefix(slotDef.role));
      setModal({ type: 'unitPicker', detachmentId, slotKey, role: matchableRole, isPrime: slotDef.prime });
    }
  }

  function handleSlotClear(detachmentId: string, slotKey: string) {
    const qualifiedKey = `${detachmentId}::${slotKey}`;
    const unlocked = detachments.filter((d) => d.unlockedBy === qualifiedKey);
    const anyUnlockedFilled = unlocked.some((d) => Object.values(d.slots).some(Boolean));

    const det = detachments.find((d) => d.id === detachmentId);
    const anyBonusFilled = (det?.bonusSlots ?? []).some(
      (b) => b.sourceSlotKey === slotKey && b.unit !== null
    );

    if (anyUnlockedFilled || anyBonusFilled) {
      setModal({
        type: 'confirmClear',
        detachmentId,
        slotKey,
        affectedIds: unlocked.map((d) => d.id),
      });
    } else {
      doClear(detachmentId, slotKey, unlocked.map((d) => d.id));
    }
  }

  function handleBonusSlotClick(detachmentId: string, bonusSlotId: string, role: string) {
    setModal({ type: 'bonusUnitPicker', detachmentId, bonusSlotId, role });
  }

  function handleBonusSlotClear(detachmentId: string, bonusSlotId: string) {
    clearBonusSlot(detachmentId, bonusSlotId);
  }

  function doClear(detachmentId: string, slotKey: string, affectedIds: string[]) {
    clearSlot(detachmentId, slotKey);
    for (const id of affectedIds) removeDetachment(id);
    setModal({ type: 'none' });
  }

  // Shared: fill slot then handle unlock chain
  function fillAndUnlock(
    detachmentId: string,
    slotKey: string,
    role: string,
    unit: Parameters<typeof fillSlot>[2],
    benefit?: Parameters<typeof fillSlot>[3]
  ) {
    fillSlot(detachmentId, slotKey, unit, benefit);

    let trigger: 'highCommand' | 'command' | null = null;
    if (role === 'High Command') trigger = 'highCommand';
    else if (role === 'Command') trigger = 'command';

    const unlockedBy = `${detachmentId}::${slotKey}`;

    if (trigger) {
      // Replace any existing unlocked detachment (changing a unit should swap, not stack)
      const existing = detachments.filter((d) => d.unlockedBy === unlockedBy);
      for (const det of existing) removeDetachment(det.id);

      const isDouble = (unit.officerOfTheLine ?? 1) > 1;
      if (isDouble) pendingDoubleUnlock.current = unlockedBy;
      setModal({ type: 'detachmentSelector', trigger, unlockedBy });
    } else {
      setModal({ type: 'none' });
    }
  }

  function handleUnitConfirmed(unit: Parameters<typeof fillSlot>[2]) {
    if (modal.type !== 'unitPicker') return;
    const { detachmentId, slotKey, role, isPrime } = modal;

    if (isEditingSlot.current) {
      // Edit mode: keep existing prime benefit, just update the unit
      const existingBenefit = detachments.find((d) => d.id === detachmentId)?.slots[slotKey]?.primeBenefit;
      fillSlot(detachmentId, slotKey, unit, existingBenefit);
      goBackToSlotEdit(detachmentId, slotKey, { unit, primeBenefit: existingBenefit });
      return;
    }

    if (isPrime) {
      // Unit chosen — now pick the prime benefit (pass role through so handler can chain unlock)
      setModal({ type: 'primeBenefit', detachmentId, slotKey, role, unit });
    } else {
      fillAndUnlock(detachmentId, slotKey, role, unit);
    }
  }

  function handleBonusSlotRoleSelected(bonusRole: string) {
    if (modal.type !== 'bonusSlotRoleSelector') return;
    const { detachmentId, slotKey, role, unit } = modal;
    addBonusSlot(detachmentId, slotKey, bonusRole);

    if (isEditingSlot.current) {
      // Return to slotEdit after adding the bonus slot role
      const det = detachments.find((d) => d.id === detachmentId);
      const filled = det?.slots[slotKey];
      if (filled) {
        goBackToSlotEdit(detachmentId, slotKey, filled);
      } else {
        isEditingSlot.current = null;
        setModal({ type: 'none' });
      }
    } else {
      // Fresh fill: trigger the detachment unlock if this is a Command/HC slot
      const unlockedBy = `${detachmentId}::${slotKey}`;
      let trigger: 'highCommand' | 'command' | null = null;
      if (role === 'High Command') trigger = 'highCommand';
      else if (role === 'Command') trigger = 'command';

      if (trigger) {
        const isDouble = (unit.officerOfTheLine ?? 1) > 1;
        if (isDouble) pendingDoubleUnlock.current = unlockedBy;
        setModal({ type: 'detachmentSelector', trigger, unlockedBy });
      } else {
        setModal({ type: 'none' });
      }
    }
  }

  function handleDetachmentSelected(def: Parameters<typeof addDetachment>[0]) {
    if (modal.type !== 'detachmentSelector') return;
    const { unlockedBy } = modal;
    addDetachment(def, unlockedBy);

    // If Officer of the Line: open a second selector
    if (pendingDoubleUnlock.current === unlockedBy) {
      pendingDoubleUnlock.current = null;
      setModal({ type: 'detachmentSelector', trigger: 'command', unlockedBy, title: 'Choose Second Auxiliary Detachment (Officer of the Line)' });
      return;
    }

    if (isEditingSlot.current) {
      const { detachmentId, slotKey } = isEditingSlot.current;
      const det = detachments.find((d) => d.id === detachmentId);
      const filled = det?.slots[slotKey];
      if (filled) {
        goBackToSlotEdit(detachmentId, slotKey, filled);
      } else {
        isEditingSlot.current = null;
        setModal({ type: 'none' });
      }
    } else {
      setModal({ type: 'none' });
    }
  }

  function handleAddWarlord() {
    const warlordDef = detachmentsData.core.find((d) => d.name === 'Warlord Detachment');
    if (warlordDef) addDetachment(warlordDef);
  }

  function handleAddLordOfWar() {
    setModal({ type: 'lordOfWarSelector' });
  }

  const hasWarlord = detachments.some((d) => d.def.name === 'Warlord Detachment');

  // ── Card positions ──
  const cardPositions = computeCardPositions(detachments);
  const instanceNumbers = computeInstanceNumbers(detachments);

  // Resolve effective position (user override takes precedence over computed)
  function getCardPos(detId: string): CardPosition {
    return positionOverrides[detId] ?? cardPositions.get(detId) ?? { x: 0, y: 0 };
  }

  return (
    <div className="flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      <AppHeader
        onExport={() => setModal({ type: 'export' })}
        hasWarlord={hasWarlord}
        onAddWarlord={handleAddWarlord}
        onAddLordOfWar={handleAddLordOfWar}
      />

      {/* Canvas area */}
      <div
        ref={outerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: draggingId ? 'grabbing' : 'grab',
          background: 'var(--cds-background)',
          userSelect: draggingId ? 'none' : undefined,
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
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
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {connections.map((conn) => (
              <ConnectorLine key={conn.id} from={conn.from} to={conn.to} />
            ))}
          </svg>

          {/* Detachment cards */}
          {detachments.map((det) => {
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
                onMouseDown={(e) => handleCardMouseDown(e, det.id, pos)}
              >
                <DetachmentCard
                  detachment={det}
                  instanceNumber={instanceNumbers.get(det.id)}
                  onSlotClick={(slotKey, slotDef) =>
                    handleSlotClick(det.id, slotKey, slotDef)
                  }
                  onSlotClear={(slotKey) => handleSlotClear(det.id, slotKey)}
                  onBonusSlotClick={(bonusSlotId, role) =>
                    handleBonusSlotClick(det.id, bonusSlotId, role)
                  }
                  onBonusSlotClear={(bonusSlotId) => handleBonusSlotClear(det.id, bonusSlotId)}
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
          onClick={() => { setZoom(1); setPan({ x: 16, y: 16 }); }}
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

      {/* Points card */}
      <PointsCard current={totalPoints} limit={pointsLimit} />

      {/* Modals */}
      {modal.type === 'slotEdit' && (() => {
        const { detachmentId, slotKey, slotDef, filled } = modal;
        const role = getBaseRole(stripPrimePrefix(slotDef.role));
        const isCommandSlot = role === 'High Command' || role === 'Command';
        const unlockedBy = `${detachmentId}::${slotKey}`;
        const unlockedDets = detachments.filter((d) => d.unlockedBy === unlockedBy);
        const trigger = role === 'High Command' ? 'highCommand' : 'command';

        const linkedDetachments = isCommandSlot
          ? unlockedDets.length > 0
            ? unlockedDets.map((det) => ({
                name: det.def.name,
                onChange: () => {
                  isEditingSlot.current = { detachmentId, slotKey };
                  removeDetachment(det.id);
                  setModal({ type: 'detachmentSelector', trigger, unlockedBy });
                },
              }))
            : [{ name: '', onChange: () => {
                isEditingSlot.current = { detachmentId, slotKey };
                setModal({ type: 'detachmentSelector', trigger, unlockedBy });
              }}]
          : undefined;

        return (
          <SlotEditModal
            slotDef={slotDef}
            filled={filled}
            linkedDetachments={linkedDetachments}
            onChangeUnit={() => {
              isEditingSlot.current = { detachmentId, slotKey };
              setModal({ type: 'unitPicker', detachmentId, slotKey, role, isPrime: slotDef.prime });
            }}
            onChangeBenefit={() => {
              isEditingSlot.current = { detachmentId, slotKey };
              setModal({ type: 'primeBenefit', detachmentId, slotKey, role, unit: filled.unit });
            }}
            onAnnotationsChange={(notes, extraPoints) =>
              updateSlotAnnotations(detachmentId, slotKey, notes, extraPoints)
            }
            onClose={() => setModal({ type: 'none' })}
          />
        );
      })()}

      {modal.type === 'unitPicker' && (
        <UnitPickerModal
          role={modal.role}
          faction={faction}
          onConfirm={handleUnitConfirmed}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'primeBenefit' && (
        <PrimeBenefitModal
          onConfirm={(benefit) => {
            if (modal.type !== 'primeBenefit') return;
            const { detachmentId, slotKey, role, unit } = modal;

            if (benefit.id === 'logistical-benefit') {
              // Clear any existing bonus slots for this slot (avoids duplicates on change)
              clearBonusSlotsForSlot(detachmentId, slotKey);
              fillSlot(detachmentId, slotKey, unit, benefit);
              // bonusSlotRoleSelector will return to slotEdit (edit mode) or trigger unlock (fresh fill)
              setModal({ type: 'bonusSlotRoleSelector', detachmentId, slotKey, role, unit });
            } else {
              if (isEditingSlot.current) {
                // Changing benefit only — clear any old bonus slots, fill, return to slotEdit
                clearBonusSlotsForSlot(detachmentId, slotKey);
                fillSlot(detachmentId, slotKey, unit, benefit);
                goBackToSlotEdit(detachmentId, slotKey, { unit, primeBenefit: benefit });
              } else {
                fillAndUnlock(detachmentId, slotKey, role, unit, benefit);
              }
            }
          }}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'bonusSlotRoleSelector' && (
        <BonusSlotRoleSelectorModal
          onConfirm={handleBonusSlotRoleSelected}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'bonusUnitPicker' && (
        <UnitPickerModal
          role={modal.role}
          faction={faction}
          onConfirm={(unit) => {
            if (modal.type !== 'bonusUnitPicker') return;
            fillBonusSlot(modal.detachmentId, modal.bonusSlotId, unit);
            setModal({ type: 'none' });
          }}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'detachmentSelector' && (
        <DetachmentSelectorModal
          trigger={modal.trigger}
          title={modal.title}
          faction={faction}
          onConfirm={handleDetachmentSelected}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'confirmClear' && (
        <ConfirmModal
          message="This slot unlocked one or more detachments with units in them. Clearing it will remove those detachments. Continue?"
          onConfirm={() =>
            modal.type === 'confirmClear' &&
            doClear(modal.detachmentId, modal.slotKey, modal.affectedIds)
          }
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'lordOfWarSelector' && (
        <DetachmentSelectorModal
          trigger="highCommand"
          title="Add Lord of War"
          faction={faction}
          onConfirm={(def) => {
            addDetachment(def);
            setModal({ type: 'none' });
          }}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'export' && (
        <ExportModal
          detachments={detachments}
          faction={faction}
          allegiance={allegiance}
          pointsLimit={pointsLimit}
          totalPoints={totalPoints}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  );
}
