/**
 * useDrawerSwipe.ts
 * On phones and tablets the modals are drawers from the right (index.scss);
 * swiping one to the right closes it. The drawer follows the finger once the
 * gesture is clearly horizontal, so vertical scrolling in its lists is left
 * alone; past a third of its width (or a quick flick) it closes through its own
 * close button, so each modal's close handling runs as usual.
 */

import { useEffect } from 'react';

/** Same as the drawer styles in index.scss */
export const DRAWER_QUERY = '(max-width: 1055px), (pointer: coarse)';

const LOCK_DISTANCE = 10; // px before deciding horizontal vs vertical
const FLICK_SPEED = 0.6; // px/ms

export function useDrawerSwipe() {
  useEffect(() => {
    const media = window.matchMedia(DRAWER_QUERY);
    let drawer: HTMLElement | null = null;
    let start = { x: 0, y: 0, t: 0 };
    let mode: 'undecided' | 'swipe' | 'scroll' = 'undecided';
    let dx = 0;

    const reset = () => {
      if (drawer) {
        drawer.style.transition = '';
        drawer.style.transform = '';
      }
      drawer = null;
      mode = 'undecided';
      dx = 0;
    };

    const onStart = (e: TouchEvent) => {
      if (!media.matches || e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      // Sliders and text selection keep their own horizontal drags
      if (target.closest('input[type="range"]')) return;
      drawer = target.closest<HTMLElement>('.cds--modal.is-visible .cds--modal-container');
      if (!drawer) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
      mode = 'undecided';
      dx = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!drawer || mode === 'scroll') return;
      const x = e.touches[0].clientX - start.x;
      const y = e.touches[0].clientY - start.y;
      if (mode === 'undecided') {
        if (Math.abs(x) < LOCK_DISTANCE && Math.abs(y) < LOCK_DISTANCE) return;
        mode = x > 0 && Math.abs(x) > Math.abs(y) * 1.5 ? 'swipe' : 'scroll';
        if (mode === 'scroll') return;
        drawer.style.transition = 'none';
      }
      dx = Math.max(0, x);
      drawer.style.transform = `translate3d(${dx}px, 0, 0)`;
      e.preventDefault();
    };

    const onEnd = () => {
      if (!drawer || mode !== 'swipe') return reset();
      const speed = dx / Math.max(1, performance.now() - start.t);
      const close = dx > drawer.offsetWidth / 3 || speed > FLICK_SPEED;
      const el = drawer;
      el.style.transition = 'transform 160ms ease-out';
      el.style.transform = close ? 'translate3d(100%, 0, 0)' : '';
      drawer = null;
      mode = 'undecided';
      if (close) {
        el.closest('.cds--modal')?.querySelector<HTMLButtonElement>('.cds--modal-close')?.click();
        // Clear the inline styles once this modal has gone (or the next one reuses the element)
        window.setTimeout(() => {
          el.style.transition = '';
          el.style.transform = '';
        }, 300);
      } else {
        window.setTimeout(() => (el.style.transition = ''), 200);
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', reset);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', reset);
    };
  }, []);
}
