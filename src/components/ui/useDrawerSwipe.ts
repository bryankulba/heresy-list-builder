/**
 * useDrawerSwipe.ts
 * On phones and tablets the modals are drawers from the right that push the
 * page aside (index.scss); swiping one to the right closes it. The drawer —
 * and the page beside it — follow the finger once the
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
    // The pushed page (.app-stage), moved back by the same amount
    let stage: HTMLElement | null = null;
    const styleBoth = (transition: string, drawerTransform: string, stageTransform: string) => {
      if (drawer) {
        drawer.style.transition = transition;
        drawer.style.transform = drawerTransform;
      }
      if (stage) {
        stage.style.transition = transition;
        stage.style.transform = stageTransform;
      }
    };
    let start = { x: 0, y: 0, t: 0 };
    let mode: 'undecided' | 'swipe' | 'scroll' = 'undecided';
    let dx = 0;

    const reset = () => {
      styleBoth('', '', '');
      drawer = null;
      stage = null;
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
      stage = document.querySelector<HTMLElement>('.app-stage--pushed');
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
      }
      dx = Math.max(0, x);
      // Plain pixels (not calc with a variable) so the release can animate from here
      styleBoth('none', `translate3d(${dx}px, 0, 0)`, `translate3d(${dx - drawer.offsetWidth}px, 0, 0)`);
      e.preventDefault();
    };

    const onEnd = () => {
      if (!drawer || mode !== 'swipe') return reset();
      const speed = dx / Math.max(1, performance.now() - start.t);
      const close = dx > drawer.offsetWidth / 3 || speed > FLICK_SPEED;
      const el = drawer;
      const page = stage;
      const settle = 'transform 160ms ease-out';
      // Finish the motion: both off to the right (closing), or back to open
      styleBoth(settle, close ? 'translate3d(100%, 0, 0)' : '', close ? 'translate3d(0, 0, 0)' : '');
      drawer = null;
      stage = null;
      mode = 'undecided';
      const release = (node: HTMLElement | null) => {
        if (!node) return;
        node.style.transition = '';
        node.style.transform = '';
      };
      if (close) {
        el.closest('.cds--modal')?.querySelector<HTMLButtonElement>('.cds--modal-close')?.click();
        // Carbon closes the modal a beat later: hold the page where the swipe left it
        // until it's no longer pushed, so it doesn't bounce back meanwhile
        if (page) {
          const observer = new MutationObserver(() => {
            if (page.classList.contains('app-stage--pushed')) return;
            observer.disconnect();
            release(page);
          });
          observer.observe(page, { attributes: true, attributeFilter: ['class'] });
          window.setTimeout(() => (observer.disconnect(), release(page)), 1500);
        }
        window.setTimeout(() => release(el), 300);
      } else {
        // Back to open: hand back to the stylesheet once settled
        window.setTimeout(() => (release(el), release(page)), 200);
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
