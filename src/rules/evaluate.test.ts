import { describe, test, expect } from 'vitest';
import { conditionsHold, effectiveHidden, evaluateCondition, type RuleContext } from './evaluate';

const ctx: RuleContext = {
  catalogueId: 'cat-dg',
  forceEntryIds: ['det-primary', 'chart-crusade'],
  unit: { 'cat-troops': 1, 'cat-sergeant': 1, 'cat-infantry': 10 },
  force: { 'unit-x': 2 },
  roster: { 'unit-x': 3 },
  rosterForces: { 'det-primary': 1 },
};

const cond = (type: string, scope: string, childId: string, value = 1, field = 'selections') => ({
  type,
  scope,
  field,
  value,
  childId,
});

describe('evaluateCondition', () => {
  test('instanceOf by scope', () => {
    expect(evaluateCondition(cond('instanceOf', 'primary-catalogue', 'cat-dg'), ctx)).toBe(true);
    expect(evaluateCondition(cond('instanceOf', 'force', 'det-primary'), ctx)).toBe(true);
    expect(evaluateCondition(cond('instanceOf', 'ancestor', 'cat-troops'), ctx)).toBe(true);
    expect(evaluateCondition(cond('instanceOf', 'ancestor', 'cat-command'), ctx)).toBe(false);
    expect(evaluateCondition(cond('notInstanceOf', 'ancestor', 'cat-command'), ctx)).toBe(true);
  });

  test('counts by scope and comparison', () => {
    expect(evaluateCondition(cond('atLeast', 'unit', 'cat-infantry', 10), ctx)).toBe(true);
    expect(evaluateCondition(cond('equalTo', 'unit', 'cat-unique', 0), ctx)).toBe(true);
    expect(evaluateCondition(cond('greaterThan', 'force', 'unit-x', 2), ctx)).toBe(false);
    expect(evaluateCondition(cond('atMost', 'roster', 'unit-x', 3), ctx)).toBe(true);
    expect(evaluateCondition(cond('atLeast', 'roster', 'det-primary', 1, 'forces'), ctx)).toBe(true);
  });

  test('unmodelled fields count as zero', () => {
    expect(evaluateCondition(cond('atLeast', 'roster', 'x', 1, 'limit::points'), ctx)).toBe(false);
  });
});

describe('conditionsHold', () => {
  test('top-level conditions and groups are AND-ed; groups honour or/and', () => {
    const holder = {
      conditions: [cond('instanceOf', 'primary-catalogue', 'cat-dg')],
      conditionGroups: [
        { type: 'or', conditions: [cond('instanceOf', 'ancestor', 'cat-command'), cond('instanceOf', 'ancestor', 'cat-troops')] },
      ],
    };
    expect(conditionsHold(holder, ctx)).toBe(true);
    expect(conditionsHold({ ...holder, conditions: [cond('instanceOf', 'primary-catalogue', 'cat-ew')] }, ctx)).toBe(false);
    expect(conditionsHold({}, ctx)).toBe(true);
  });
});

describe('effectiveHidden', () => {
  test('applies set-hidden modifiers in order when their conditions hold', () => {
    const mods = [
      { type: 'set', field: 'hidden', value: false, conditions: [cond('instanceOf', 'primary-catalogue', 'cat-dg')] },
      { type: 'set', field: 'hidden', value: true, conditions: [cond('atLeast', 'unit', 'cat-unique')] },
    ];
    expect(effectiveHidden(true, mods, ctx)).toBe(false);
    expect(effectiveHidden(true, mods, { ...ctx, unit: { ...ctx.unit, 'cat-unique': 1 } })).toBe(true);
  });
});
