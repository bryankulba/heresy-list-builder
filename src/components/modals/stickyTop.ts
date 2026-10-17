import type React from 'react';

/**
 * A modal body's sticky top block (search, filters): pinned at the very top of
 * the scroll area — over the body's 8px top padding, so rows don't show above
 * it — on the modal's own background (inside a modal `--cds-layer` is a shade
 * lighter than the modal itself).
 */
export const STICKY_TOP: React.CSSProperties = {
  position: 'sticky',
  top: -8,
  marginTop: -8,
  paddingTop: 8,
  zIndex: 1,
  background: 'var(--cds-layer-01)',
};
