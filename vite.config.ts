import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: ['node_modules'],
        silenceDeprecations: ['import'],
      },
    },
  },
  server: {
    fs: {
      // Allow importing from data/parsed/ which is outside src/
      allow: ['..'],
    },
  },
});
