/**
 * UpdatePrompt.tsx
 * The service worker caches the app for offline use (vite-plugin-pwa) quietly;
 * this only speaks up when a new version has been downloaded, offering a
 * reload — the open list is kept (it's in local storage), so reloading is safe.
 */

import React from 'react';
import { ActionableNotification } from '@carbon/react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const POSITION: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
  zIndex: 9000,
  maxWidth: 'calc(100vw - 32px)',
};

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div style={POSITION}>
      <ActionableNotification
        kind="info"
        title="Update available"
        subtitle="A new version of the builder is ready."
        actionButtonLabel="Reload"
        onActionButtonClick={() => updateServiceWorker(true)}
        onClose={() => setNeedRefresh(false)}
        lowContrast
        inline
      />
    </div>
  );
}
