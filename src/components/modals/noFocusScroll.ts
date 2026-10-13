import type React from 'react';

/**
 * Pressing an option partly hidden at the edge of a modal's scroll area would
 * focus it, and the browser scrolls a focused element into view — so the list
 * jumped under the cursor and the click landed on something else. Option
 * buttons skip focus on mouse press (the click still fires; Tab still focuses).
 */
export const noFocusScroll = (e: React.MouseEvent) => e.preventDefault();
