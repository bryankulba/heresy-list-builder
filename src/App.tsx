import React, { useEffect, useState } from 'react';
import { Theme } from '@carbon/react';
import { useRosterStore } from './store/rosterStore';
import StartScreen from './components/StartScreen';
import Canvas from './components/canvas/Canvas';
import { useDrawerSwipe } from './components/ui/useDrawerSwipe';
import UpdatePrompt from './components/ui/UpdatePrompt';

export default function App() {
  const phase = useRosterStore((s) => s.phase);
  // Phones and tablets: swipe a modal drawer right to close it
  useDrawerSwipe();
  const ensureUnitsLoaded = useRosterStore((s) => s.ensureUnitsLoaded);
  // A restored session's armies are loaded before the canvas shows them
  const [ready, setReady] = useState(phase === 'start');
  useEffect(() => {
    if (ready) return;
    ensureUnitsLoaded().finally(() => setReady(true));
  }, [ready, ensureUnitsLoaded]);

  return (
    <Theme theme="g100">
      {phase === 'start' ? (
        <StartScreen />
      ) : ready ? (
        <Canvas />
      ) : (
        <div style={{ minHeight: '100vh', background: 'var(--cds-background)' }} aria-busy="true" />
      )}
      {/* Update prompt when a new version is downloaded (service worker) */}
      <UpdatePrompt />
    </Theme>
  );
}
