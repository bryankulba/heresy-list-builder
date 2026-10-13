import { useEffect, useState } from 'react';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/**
 * The phone layout (stacked cards, points bar): below Carbon's md breakpoint
 * (672px), or a touch screen too short for the canvas (a phone held sideways).
 * Matches the bottom-sheet modal styles in index.scss.
 */
export const PHONE_QUERY = '(max-width: 671px), (max-height: 500px) and (pointer: coarse)';
export const useIsPhone = () => useMediaQuery(PHONE_QUERY);

/** Below Carbon's lg breakpoint (1056px): header actions go in a menu. */
export const useIsCompactHeader = () => useMediaQuery('(max-width: 1055px)');
