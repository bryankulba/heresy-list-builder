/**
 * useCanvasViewport.ts
 * Pan (drag or scroll), zoom (pinch / ctrl+scroll, centred on the cursor) and
 * long-press card dragging for the canvas. Panning moves the inner canvas with
 * a CSS transform, never by scrolling.
 */

import React, { useRef, useState } from 'react';
import type { CardPosition } from './canvasLayout';

const HOME = { x: 16, y: 16 };
const LONG_PRESS_MS = 350;

export function useCanvasViewport() {
  const outerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState(HOME);
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

  // Card drag (long press), with positions overriding the computed layout
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

  function resetView() {
    setZoom(1);
    setPan(HOME);
  }

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
      setPositionOverrides((prev) => ({ ...prev, [ds.detId]: { x: ds.startCardX + dx, y: ds.startCardY + dy } }));
      return;
    }

    // Cancel the long press if the mouse moves too much before it fires
    if (longPressTimer.current && dragState.current) {
      const ds = dragState.current;
      if (Math.abs(e.clientX - ds.startMouseX) > 5 || Math.abs(e.clientY - ds.startMouseY) > 5) {
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
      // Pinch (trackpad) or ctrl+scroll → zoom, keeping the point under the cursor fixed
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      const newZoom = Math.max(0.2, Math.min(3, zoom * factor));
      const rect = outerRef.current!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setPan({
        x: mouseX - ((mouseX - pan.x) / zoom) * newZoom,
        y: mouseY - ((mouseY - pan.y) / zoom) * newZoom,
      });
      setZoom(newZoom);
    } else {
      // Two-finger or regular scroll → pan
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
    resetView();
  }

  function handleCardMouseDown(e: React.MouseEvent, detId: string, pos: CardPosition) {
    // Don't start a drag from interactive elements
    if ((e.target as HTMLElement).closest('button, input, select, [data-interactive]')) return;
    dragState.current = { detId, startMouseX: e.clientX, startMouseY: e.clientY, startCardX: pos.x, startCardY: pos.y, active: false };
    longPressTimer.current = setTimeout(() => {
      if (dragState.current) {
        dragState.current.active = true;
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
    handleCardMouseDown,
    viewportHandlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp, onWheel, onDoubleClick },
  };
}
