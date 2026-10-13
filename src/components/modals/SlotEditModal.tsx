import React, { useState } from 'react';
import { ComposedModal, ModalHeader, ModalBody, ModalFooter, Button, TextInput, NumberInput } from '@carbon/react';
import type { FilledSlot, SlotDef } from '../../types';
import { getBaseRole, stripPrimePrefix, getDetachmentDisplayName } from '../../data/loader';
import { isSizeAdjustable, modelCount, modelKey, slotPoints, unitModelTotal } from '../../rules/unitSize';

export interface LinkedDetachmentRow {
  name: string;
  onChange: () => void;
}

interface SlotEditModalProps {
  slotDef: SlotDef;
  filled: FilledSlot;
  /** Apex/aux detachments unlocked by this slot (1 for normal Command, 2 for Officer of the Line) */
  linkedDetachments?: LinkedDetachmentRow[];
  onChangeUnit: () => void;
  onChangeBenefit: () => void;
  onAnnotationsChange: (notes: string, extraPoints: number) => void;
  /** Sets how many of a model type (by modelKey) the unit has */
  onModelCountChange: (modelKey: string, count: number) => void;
  /** Empties the slot (and removes what it unlocked, asking first if those have units) */
  onRemove: () => void;
  onClose: () => void;
}

/** − value + buttons, big enough to tap; the value can also be typed. */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const button = (text: string, next: number, disabled: boolean) => (
    <button
      type="button"
      aria-label={`${text === '−' ? 'Fewer' : 'More'} ${label}`}
      disabled={disabled}
      onClick={() => onChange(next)}
      style={{
        width: 36,
        height: 36,
        fontSize: 18,
        lineHeight: 1,
        background: 'var(--cds-field-01, var(--cds-layer-01))',
        border: '1px solid var(--cds-border-strong-01)',
        color: disabled ? 'var(--cds-text-disabled)' : 'var(--cds-text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {text}
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      {button('−', value - 1, value <= min)}
      <input
        aria-label={label}
        inputMode="numeric"
        value={draft ?? String(value)}
        // Typing replaces the number rather than adding to it
        // (a frame later: Safari's mouseup would otherwise undo the selection)
        onFocus={(e) => {
          const input = e.target;
          requestAnimationFrame(() => input.select());
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => {
          if (draft !== null && draft !== '') onChange(Math.max(min, Math.min(max, Number(draft))));
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        style={{
          width: 44,
          height: 36,
          textAlign: 'center',
          fontSize: 14,
          background: 'transparent',
          border: '1px solid var(--cds-border-subtle-01)',
          color: 'var(--cds-text-primary)',
        }}
      />
      {button('+', value + 1, value >= max)}
    </div>
  );
}

export default function SlotEditModal({
  slotDef,
  filled,
  linkedDetachments,
  onChangeUnit,
  onChangeBenefit,
  onAnnotationsChange,
  onModelCountChange,
  onRemove,
  onClose,
}: SlotEditModalProps) {
  const displayRole = getBaseRole(stripPrimePrefix(slotDef.role));
  const sizeModels = filled.unit.models.filter(isSizeAdjustable);
  const [notes, setNotes] = useState(filled.notes ?? '');
  const [extraPoints, setExtraPoints] = useState(filled.extraPoints ?? 0);

  function handleNotesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNotes(val);
    onAnnotationsChange(val, extraPoints);
  }

  function handleExtraPointsChange(_e: unknown, { value }: { value: string | number }) {
    const num = typeof value === 'number' ? value : parseInt(value as string, 10);
    const val = isNaN(num) ? 0 : Math.max(0, num);
    setExtraPoints(val);
    onAnnotationsChange(notes, val);
  }

  return (
    <ComposedModal open onClose={onClose} size="sm">
      <ModalHeader title={displayRole} />
      <ModalBody hasForm>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Unit row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '12px 14px',
              background: 'var(--cds-layer-02)',
              border: '1px solid var(--cds-border-subtle-01)',
              borderRadius: 4,
            }}
          >
            <div>
              <div
                style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cds-text-secondary)', marginBottom: 3 }}
              >
                Unit
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cds-text-primary)' }}>
                {filled.unit.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)', marginTop: 2 }}>
                {slotPoints(filled)}pts
                {sizeModels.length > 0 && ` · ${unitModelTotal(filled)} models`}
              </div>
            </div>
            <Button kind="ghost" size="sm" onClick={onChangeUnit}>
              Change
            </Button>
          </div>

          {/* Unit size — a stepper per model type with a range (Legionaries 9–19), at BSData's cost per model */}
          {sizeModels.length > 0 && (
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--cds-layer-02)',
                border: '1px solid var(--cds-border-subtle-01)',
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cds-text-secondary)' }}>
                Unit size
              </div>
              {sizeModels.map((m) => {
                const key = modelKey(m);
                const n = modelCount(filled, m);
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: 'var(--cds-text-primary)' }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--cds-text-secondary)' }}>
                        {m.min}–{m.max}
                        {m.cost > 0 ? ` · ${m.cost}pts each` : ''}
                      </div>
                    </div>
                    <Stepper
                      label={m.name}
                      value={n}
                      min={m.min}
                      max={m.max}
                      onChange={(v) => onModelCountChange(key, v)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Linked detachment rows — one per unlocked detachment (2 for Officer of the Line) */}
          {linkedDetachments?.map((linked, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 14px',
                background: 'var(--cds-layer-02)',
                border: '1px solid var(--cds-border-subtle-01)',
                borderRadius: 4,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cds-text-secondary)', marginBottom: 3 }}
                >
                  {linkedDetachments.length > 1 ? `Linked Detachment ${i + 1}` : 'Linked Detachment'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: linked.name ? 'var(--cds-text-primary)' : 'var(--cds-text-placeholder)' }}>
                  {linked.name ? getDetachmentDisplayName(linked.name) : 'None selected'}
                </div>
              </div>
              <Button kind="ghost" size="sm" onClick={linked.onChange}>
                {linked.name ? 'Change' : 'Select'}
              </Button>
            </div>
          ))}

          {/* Prime benefit row — only shown for prime slots */}
          {slotDef.prime && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 14px',
                background: 'var(--cds-layer-02)',
                border: '1px solid var(--cds-support-warning)',
                borderRadius: 4,
              }}
            >
              <div>
                <div
                  style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cds-support-warning)', marginBottom: 3 }}
                >
                  Prime Benefit
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cds-text-primary)' }}>
                  {filled.primeBenefit?.name ?? '—'}
                  {filled.lbRole ? ` — ${filled.lbRole}` : ''}
                </div>
              </div>
              <Button kind="ghost" size="sm" onClick={onChangeBenefit}>
                Change
              </Button>
            </div>
          )}

          {/* Loadout annotations */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <TextInput
                id="slot-notes"
                labelText="Loadout Notes"
                placeholder="e.g. with plasma guns"
                value={notes}
                onChange={handleNotesChange}
                size="sm"
              />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <NumberInput
                id="slot-extra-points"
                label="Extra Points"
                value={extraPoints}
                min={0}
                onChange={handleExtraPointsChange}
                size="sm"
                hideSteppers
              />
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="danger--ghost" onClick={onRemove}>
          Remove unit
        </Button>
        <Button kind="secondary" onClick={onClose}>
          Done
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
