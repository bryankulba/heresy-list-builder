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

/** Below Carbon's md breakpoint (672px): the phone layout (stacked cards, points bar). */
export const useIsPhone = () => useMediaQuery('(max-width: 671px)');

/** Below Carbon's lg breakpoint (1056px): header actions go in a menu. */
export const useIsCompactHeader = () => useMediaQuery('(max-width: 1055px)');
