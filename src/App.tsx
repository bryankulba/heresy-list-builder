import React from 'react';
import { Theme } from '@carbon/react';
import { useRosterStore } from './store/rosterStore';
import StartScreen from './components/StartScreen';
import Canvas from './components/canvas/Canvas';

export default function App() {
  const phase = useRosterStore((s) => s.phase);
  return (
    <Theme theme="g100">
      {phase === 'start' ? <StartScreen /> : <Canvas />}
    </Theme>
  );
}
