import React from 'react';
import { Close } from '@carbon/icons-react';
import type { FilledSlot, SlotDef } from '../../types';
import RoleIcon from '../ui/RoleIcon';
import { getBaseRole, stripPrimePrefix } from '../../data/loader';

interface SlotProps {
  slotDef: SlotDef;
  filled: FilledSlot | null | undefined;
  onClick: () => void;
  onClear: () => void;
  slotRef?: (el: HTMLDivElement | null) => void;
  isDashed?: boolean;
}

export default function Slot({ slotDef, filled, onClick, onClear, slotRef, isDashed }: SlotProps) {
  const isPrime = slotDef.prime;
  const displayRole = getBaseRole(stripPrimePrefix(slotDef.role));
  const isFilled = !!filled;

  function handleClick() {
    onClick();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onClear();
  }

  const circleSize = isFilled ? 38 : 30;
  const iconSize = isFilled ? 22 : 17;

  return (
    <div
      ref={slotRef}
      data-interactive
      onClick={handleClick}
      className="relative flex flex-col items-center transition-all duration-150"
      style={{
        width: isFilled ? 72 : 56,
        minHeight: isFilled ? 88 : 68,
        padding: isFilled ? '8px 6px' : '6px 4px',
        borderRadius: 4,
        background: isFilled ? 'var(--cds-layer-03)' : 'var(--cds-layer-02)',
        border: `${isDashed ? '1px dashed' : '1px solid'} ${
          isFilled ? 'var(--cds-border-strong-01)' : 'var(--cds-border-subtle-01)'
        }`,
        opacity: isFilled ? 1 : 0.55,
        cursor: 'pointer',
      }}
    >
      {/* Clear button */}
      {isFilled && (
        <button
          onClick={handleClear}
          className="absolute top-0.5 right-0.5 rounded flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            background: 'transparent',
            border: 'none',
            color: 'var(--cds-text-secondary)',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label="Clear slot"
        >
          <Close size={12} />
        </button>
      )}

      {/* Icon in circle — yellow border for prime */}
      <div
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: '50%',
          border: `2px solid ${isPrime ? 'var(--cds-support-warning)' : 'var(--cds-border-subtle-02, var(--cds-border-subtle-01))'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isPrime ? 'rgba(244, 171, 0, 0.08)' : 'transparent',
        }}
      >
        <RoleIcon
          role={displayRole}
          size={iconSize}
          className={isFilled ? '' : 'opacity-70'}
        />
      </div>

      {/* Unit name (filled only) */}
      {isFilled && filled && (
        <span
          className="text-center leading-tight mt-1"
          style={{
            fontSize: 9,
            color: 'var(--cds-text-primary)',
            maxWidth: 64,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {filled.unit.name}
        </span>
      )}

      {/* Prime benefit label (filled prime only) */}
      {isFilled && filled?.primeBenefit && (
        <span
          className="text-center leading-tight mt-0.5"
          style={{
            fontSize: 8,
            color: 'var(--cds-support-warning)',
            fontStyle: 'italic',
            maxWidth: 64,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filled.primeBenefit.name}
        </span>
      )}
    </div>
  );
}
