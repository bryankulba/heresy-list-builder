/**
 * useCanvasViewport.ts
 * Pan, zoom and long-press card dragging for the canvas, with pointer events
 * so mouse, pen and touch all work:
 *  - mouse: drag the background to pan, scroll to pan, ctrl/pinch-scroll to zoom
 *  - touch: one finger pans (from anywhere, cards included), two fingers
 *    pinch-zoom around their midpoint
 *  - long press on a card drags it (mouse or touch); a tap still opens a slot
 * Panning moves the inner canvas with a CSS transform, never by scrolling.
 */

import React, { useRef, useState } from 'react';
import type { CardPosition } from './canvasLayout';

const HOME = { x: 16, y: 16 };
const LONG_PRESS_MS = 350;
const MOVE_TOLERANCE = 6; // px a press may wander before it's a pan, not a long press
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

export function useCanvasViewport() {
  const outerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState(HOME);
  const [zoom, setZoom] = useState(1);
  // Latest values for gesture maths inside event handlers
  const view = useRef({ pan, zoom });
  view.current = { pan, zoom };

  // Active pointers and the gesture they make
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchStart = useRef<{ dist: number; zoom: number; mid: { x: number; y: number }; pan: { x: number; y: number } } | null>(null);

  // Card drag (long press), with positions overriding the computed layout
  const [positionOverrides, setPositionOverrides] = useState<Record<string, CardPosition>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const drag = useRef<{ detId: string; startX: number; startY: number; cardX: number; cardY: number; active: boolean } | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  };

  function resetView() {
    setZoom(1);
    setPan(HOME);
  }

  /** A point relative to the viewport element. */
  const local = (x: number, y: number) => {
    const rect = outerRef.current!.getBoundingClientRect();
    return { x: x - rect.left, y: y - rect.top };
  };

  /** Zoom to `next`, keeping the canvas point under `at` (viewport coordinates) fixed. */
  function zoomAround(next: number, at: { x: number; y: number }, from = view.current) {
    const z = clampZoom(next);
    setPan({ x: at.x - ((at.x - from.pan.x) / from.zoom) * z, y: at.y - ((at.y - from.pan.y) / from.zoom) * z });
    setZoom(z);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    // Mouse pans from the background only (cards take clicks and long presses);
    // touch pans from anywhere but controls
    const noPan = e.pointerType === 'mouse' ? target.closest('[data-no-pan]') : target.closest('button, input, select');
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      panStart.current = noPan ? null : { x: e.clientX, y: e.clientY, panX: view.current.pan.x, panY: view.current.pan.y };
    } else if (pointers.current.size === 2) {
      // Second finger: pinch instead of pan or drag
      cancelLongPress();
      drag.current = null;
      setDraggingId(null);
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        zoom: view.current.zoom,
        mid: local((a.x + b.x) / 2, (a.y + b.y) / 2),
        pan: view.current.pan,
      };
      panStart.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Dragging a card
    const d = drag.current;
    if (d?.active) {
      const z = view.current.zoom;
      setPositionOverrides((prev) => ({
        ...prev,
        [d.detId]: { x: d.cardX + (e.clientX - d.startX) / z, y: d.cardY + (e.clientY - d.startY) / z },
      }));
      return;
    }
    // Moved before the long press fired: it's a pan, not a drag
    if (d && (Math.abs(e.clientX - d.startX) > MOVE_TOLERANCE || Math.abs(e.clientY - d.startY) > MOVE_TOLERANCE)) {
      cancelLongPress();
      drag.current = null;
    }

    // Pinch zoom
    if (pinchStart.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const p = pinchStart.current;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const z = clampZoom((p.zoom * dist) / p.dist);
      // Keep the canvas point that was under the starting midpoint under the fingers
      setPan({ x: mid.x - ((p.mid.x - p.pan.x) / p.zoom) * z, y: mid.y - ((p.mid.y - p.pan.y) / p.zoom) * z });
      setZoom(z);
      return;
    }

    // Pan
    const s = panStart.current;
    if (s) setPan({ x: s.panX + (e.clientX - s.x), y: s.panY + (e.clientY - s.y) });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 1) {
      // One finger left after a pinch: carry on panning from where it is
      const [p] = [...pointers.current.values()];
      panStart.current = { x: p.x, y: p.y, panX: view.current.pan.x, panY: view.current.pan.y };
    }
    if (pointers.current.size === 0) {
      panStart.current = null;
      cancelLongPress();
      drag.current = null;
      setDraggingId(null);
    }
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.ctrlKey) {
      // Trackpad pinch or ctrl+scroll → zoom around the cursor
      zoomAround(view.current.zoom * (e.deltaY > 0 ? 0.95 : 1.05), local(e.clientX, e.clientY));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
    resetView();
  }

  /** Long press on a card starts dragging it. */
  function handleCardPointerDown(e: React.PointerEvent, detId: string, pos: CardPosition) {
    if ((e.target as HTMLElement).closest('button, input, select, [data-interactive]') && e.pointerType === 'mouse') return;
    drag.current = { detId, startX: e.clientX, startY: e.clientY, cardX: pos.x, cardY: pos.y, active: false };
    cancelLongPress();
    longPress.current = setTimeout(() => {
      if (drag.current && pointers.current.size <= 1) {
        drag.current.active = true;
        panStart.current = null;
        setDraggingId(detId);
      }
    }, LONG_PRESS_MS);
  }

  return {
    outerRef,
    pan,
    zoom,
    resetView,
    positionOverrides,
    draggingId,
    handleCardPointerDown,
    viewportHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerLeave: onPointerUp,
      onWheel,
      onDoubleClick,
    },
  };
}
