/**
 * useConnections.ts
 * The lines from a High Command / Command slot to the detachments it unlocked,
 * measured from the rendered card and slot elements after each layout.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PlacedDetachment } from '../../types';

export interface Connection {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/**
 * `deps` are whatever moves cards (pan, zoom, dragged positions); `zoom`
 * converts screen coordinates back to canvas coordinates.
 */
export function useConnections(detachments: PlacedDetachment[], zoom: number, deps: unknown[]) {
  const innerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connections, setConnections] = useState<Connection[]>([]);

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

  useLayoutEffect(() => {
    if (!innerRef.current) return;
    const innerRect = innerRef.current.getBoundingClientRect();
    const next: Connection[] = [];
    for (const det of detachments) {
      if (!det.unlockedBy) continue;
      const cardEl = cardRefs.current.get(det.id);
      const slotEl = slotRefs.current.get(det.unlockedBy);
      if (!cardEl || !slotEl) continue;
      const cardRect = cardEl.getBoundingClientRect();
      const slotRect = slotEl.getBoundingClientRect();
      // Screen-space rects; divide by zoom for canvas-local coordinates
      next.push({
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
    setConnections(next);
  }, [detachments, zoom, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { innerRef, connections, cardRefCallback, slotRefCallback };
}
