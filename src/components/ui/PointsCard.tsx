import React, { useState } from 'react';
import { ChevronDown, ChevronUp, WarningAltFilled } from '@carbon/icons-react';

interface PointsCardProps {
  current: number;
  limit: number;
  /** Detachment limits of the primary army, e.g. "Auxiliary" 3 of 3 (from BSData) */
  allowances?: Array<{ label: string; used: number; max: number }>;
  /** Roster warnings — listed on demand; they never block building or export */
  warnings?: Array<{ id: string; message: string }>;
  /** Phones: a full-width bar along the bottom instead of a floating card */
  variant?: 'card' | 'bar';
}

export default function PointsCard({ current, limit, allowances = [], warnings = [], variant = 'card' }: PointsCardProps) {
  const bar = variant === 'bar';
  const [showWarnings, setShowWarnings] = useState(false);
  const pct = Math.min(current / limit, 1);
  const isOver = current > limit;
  const barColor = isOver ? 'var(--cds-support-error)' : 'var(--cds-interactive)';

  return (
    <div
      style={{
        position: 'fixed',
        background: 'var(--cds-layer-02)',
        border: '1px solid var(--cds-border-subtle-01)',
        zIndex: 100,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        ...(bar
          ? { bottom: 0, left: 0, right: 0, borderWidth: '1px 0 0', padding: '8px 16px 10px' }
          : { bottom: 24, right: 24, borderRadius: 4, padding: '12px 16px', minWidth: 160, maxWidth: 320 }),
      }}
    >
      {/* Bar (phones): points and detachment counts side by side */}
      <div style={bar ? { display: 'flex', alignItems: 'center', gap: 16 } : undefined}>
        <div style={bar ? { flex: 1, minWidth: 0 } : undefined}>
          {!bar && (
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
          )}
          <div
            style={{
              color: isOver ? 'var(--cds-support-error)' : 'var(--cds-text-primary)',
              fontSize: bar ? 18 : 22,
              fontWeight: 600,
              lineHeight: 1,
              marginBottom: bar ? 6 : 8,
            }}
          >
            {current.toLocaleString()}
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--cds-text-secondary)', marginLeft: 4 }}>
              / {limit.toLocaleString()}
              {bar ? ' pts' : ''}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, borderRadius: 2, background: 'var(--cds-layer-03)', overflow: 'hidden' }}>
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
        </div>

        {/* Detachments used / allowed — over the limit is a warning, never a block */}
        <div style={bar ? { display: 'flex', flexDirection: 'column', gap: 2 } : undefined}>
          {allowances.map((a) => (
            <div
              key={a.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                marginTop: bar ? 0 : 6,
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
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ marginTop: bar ? 6 : 8, borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: 6 }}>
          <button
            data-interactive
            onClick={() => setShowWarnings((v) => !v)}
            aria-expanded={showWarnings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--cds-support-error)',
              fontSize: 12,
            }}
          >
            <WarningAltFilled size={14} />
            <span style={{ flex: 1, textAlign: 'left' }}>
              {warnings.length} warning{warnings.length > 1 ? 's' : ''}
            </span>
            {showWarnings ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {showWarnings && (
            <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', maxHeight: 240, overflowY: 'auto' }}>
              {warnings.map((w) => (
                <li
                  key={w.id}
                  style={{ fontSize: 11, color: 'var(--cds-text-secondary)', padding: '3px 0', lineHeight: 1.35 }}
                >
                  {w.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
