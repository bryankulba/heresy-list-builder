import React from 'react';

interface PointsCardProps {
  current: number;
  limit: number;
  /** Detachment limits of the primary army, e.g. "Auxiliary" 3 of 3 (from BSData) */
  allowances?: Array<{ label: string; used: number; max: number }>;
}

export default function PointsCard({ current, limit, allowances = [] }: PointsCardProps) {
  const pct = Math.min(current / limit, 1);
  const isOver = current > limit;
  const barColor = isOver ? 'var(--cds-support-error)' : 'var(--cds-interactive)';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        background: 'var(--cds-layer-02)',
        border: '1px solid var(--cds-border-subtle-01)',
        borderRadius: 4,
        padding: '12px 16px',
        minWidth: 160,
        zIndex: 100,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          color: 'var(--cds-text-secondary)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 6,
        }}
      >
        Points
      </div>
      <div
        style={{
          color: isOver ? 'var(--cds-support-error)' : 'var(--cds-text-primary)',
          fontSize: 22,
          fontWeight: 600,
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {current.toLocaleString()}
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--cds-text-secondary)', marginLeft: 4 }}>
          / {limit.toLocaleString()}
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 3,
          borderRadius: 2,
          background: 'var(--cds-layer-03)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            background: barColor,
            borderRadius: 2,
            transition: 'width 0.2s ease, background 0.2s ease',
          }}
        />
      </div>

      {isOver && (
        <div style={{ color: 'var(--cds-support-error)', fontSize: 10, marginTop: 4 }}>
          Over by {(current - limit).toLocaleString()}pts
        </div>
      )}

      {/* Detachments used / allowed — over the limit is a warning, never a block */}
      {allowances.map((a) => (
        <div
          key={a.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 6,
            fontSize: 11,
            color: a.used > a.max ? 'var(--cds-support-error)' : 'var(--cds-text-secondary)',
          }}
          title={a.used > a.max ? `${a.used - a.max} more ${a.label} detachment(s) than the army allows` : undefined}
        >
          <span>{a.label}</span>
          <span>
            {a.used} / {a.max}
          </span>
        </div>
      ))}
    </div>
  );
}
