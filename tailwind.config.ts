import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'cds-background': 'var(--cds-background)',
        'cds-layer-01': 'var(--cds-layer-01)',
        'cds-layer-02': 'var(--cds-layer-02)',
        'cds-layer-03': 'var(--cds-layer-03)',
        'cds-text-primary': 'var(--cds-text-primary)',
        'cds-text-secondary': 'var(--cds-text-secondary)',
        'cds-text-placeholder': 'var(--cds-text-placeholder)',
        'cds-border-subtle': 'var(--cds-border-subtle-01)',
        'cds-border-strong': 'var(--cds-border-strong-01)',
        'cds-interactive': 'var(--cds-interactive)',
        'cds-support-warning': 'var(--cds-support-warning)',
        'cds-support-error': 'var(--cds-support-error)',
        'cds-layer-accent': 'var(--cds-layer-accent-01)',
      },
    },
  },
  plugins: [],
} satisfies Config;
