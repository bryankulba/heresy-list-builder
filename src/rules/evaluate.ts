/**
 * evaluate.ts
 * A small evaluator for BattleScribe conditions and modifiers, as kept in the
 * parsed data (scripts/parse-bsdata.ts → RuleCondition / RuleModifier).
 *
 * It answers questions like "is this Prime benefit visible for this unit in
 * this slot?" from a RuleContext describing where the entry sits. Anything the
 * roster doesn't contain counts as 0 — which is accurate for this app, since
 * selections it can't create (legion rites, army-wide upgrades…) are absent.
 */

export interface RuleCondition {
  type: string;
  scope: string;
  field: string;
  value: number;
  childId?: string;
}

export interface RuleConditionGroup {
  type: string;
  conditions?: RuleCondition[];
  conditionGroups?: RuleConditionGroup[];
}

export interface RuleRepeat {
  value: number;
  repeats: number;
  field: string;
  scope: string;
  childId?: string;
  roundUp?: boolean;
}

export interface RuleModifier {
  type: string;
  field: string;
  value: string | number | boolean;
  conditions?: RuleCondition[];
  conditionGroups?: RuleConditionGroup[];
  repeats?: RuleRepeat[];
}

/** Where an entry sits, in BattleScribe terms. Counts are keyed by entry or category id. */
export interface RuleContext {
  /** Catalogue id of the force (BattleScribe "primary-catalogue") */
  catalogueId: string;
  /** Force entry ids the entry is inside: its detachment and that detachment's chart */
  forceEntryIds: string[];
  /** Ids/categories of the unit the entry belongs to (scopes unit/self/parent) */
  unit: Record<string, number>;
  /** Selections in the same detachment */
  force: Record<string, number>;
  /** Selections in the whole roster */
  roster: Record<string, number>;
  /** Detachments/charts in the roster, by force entry id */
  rosterForces: Record<string, number>;
  /**
   * What "self"/"parent" refer to: entries inside a unit (default) or a
   * detachment's own slots, whose parent is the detachment itself.
   */
  level?: 'unit' | 'detachment';
}

function isInForce(ctx: RuleContext, id: string): boolean {
  return id === ctx.catalogueId || ctx.forceEntryIds.includes(id);
}

function instanceOf(c: RuleCondition, ctx: RuleContext): boolean {
  const id = c.childId ?? '';
  switch (c.scope) {
    case 'primary-catalogue':
    case 'force':
      return isInForce(ctx, id);
    case 'ancestor':
    case 'parent':
      // The unit itself (and its categories), its detachment, chart and catalogue.
      // "parent" is the unit for entries inside it, but the detachment for the
      // unit's own link (e.g. "set primary category if parent is a Dreadnought Talon").
      return isInForce(ctx, id) || (ctx.unit[id] ?? 0) > 0;
    case 'unit':
    case 'self':
      return (ctx.unit[id] ?? 0) > 0;
    default:
      return false;
  }
}

function count(c: Pick<RuleCondition, 'field' | 'scope' | 'childId'>, ctx: RuleContext): number {
  const id = c.childId ?? '';
  if (c.field === 'forces') return ctx.rosterForces[id] ?? 0;
  if (c.field !== 'selections') return 0; // cost/limit fields aren't modelled
  if (ctx.level === 'detachment' && (c.scope === 'self' || c.scope === 'parent' || c.scope === 'unit')) {
    return ctx.force[id] ?? 0;
  }
  switch (c.scope) {
    case 'unit':
    case 'self':
    case 'parent':
      return ctx.unit[id] ?? 0;
    case 'force':
    case 'ancestor':
      return ctx.force[id] ?? 0;
    case 'roster':
    case 'primary-catalogue':
      return ctx.roster[id] ?? 0;
    default:
      return 0;
  }
}

export function evaluateCondition(c: RuleCondition, ctx: RuleContext): boolean {
  switch (c.type) {
    case 'instanceOf':
      return instanceOf(c, ctx);
    case 'notInstanceOf':
      return !instanceOf(c, ctx);
    case 'atLeast':
      return count(c, ctx) >= c.value;
    case 'greaterThan':
      return count(c, ctx) > c.value;
    case 'atMost':
      return count(c, ctx) <= c.value;
    case 'lessThan':
      return count(c, ctx) < c.value;
    case 'equalTo':
      return count(c, ctx) === c.value;
    case 'notEqualTo':
      return count(c, ctx) !== c.value;
    default:
      return false;
  }
}

/** Do a holder's conditions (implicitly AND-ed with its condition groups) hold? Empty = true. */
export function conditionsHold(
  holder: { conditions?: RuleCondition[]; conditionGroups?: RuleConditionGroup[] },
  ctx: RuleContext
): boolean {
  const results = [
    ...(holder.conditions ?? []).map((c) => evaluateCondition(c, ctx)),
    ...(holder.conditionGroups ?? []).map((g) => groupHolds(g, ctx)),
  ];
  return results.every(Boolean);
}

function groupHolds(group: RuleConditionGroup, ctx: RuleContext): boolean {
  const results = [
    ...(group.conditions ?? []).map((c) => evaluateCondition(c, ctx)),
    ...(group.conditionGroups ?? []).map((g) => groupHolds(g, ctx)),
  ];
  if (results.length === 0) return true;
  return group.type === 'or' ? results.some(Boolean) : results.every(Boolean);
}

/** How many times a modifier applies: 1, or once per `value` matching selections when it repeats. */
function repetitions(m: RuleModifier, ctx: RuleContext): number {
  if (!m.repeats?.length) return 1;
  return m.repeats.reduce((total, r) => {
    const n = r.value > 0 ? count(r, ctx) / r.value : 0;
    return total + (r.roundUp ? Math.ceil(n) : Math.floor(n)) * r.repeats;
  }, 0);
}

/** Applies numeric set/increment/decrement modifiers targeting `field` in order. */
export function applyNumericModifiers(
  base: number,
  modifiers: RuleModifier[] | undefined,
  ctx: RuleContext
): number {
  let value = base;
  for (const m of modifiers ?? []) {
    if (!conditionsHold(m, ctx)) continue;
    const amount = Number(m.value);
    if (Number.isNaN(amount)) continue;
    const times = repetitions(m, ctx);
    if (m.type === 'set') value = amount;
    else if (m.type === 'increment') value += amount * times;
    else if (m.type === 'decrement') value -= amount * times;
  }
  return Math.max(0, value);
}

/** Applies `set hidden` modifiers in order to a base hidden flag. */
export function effectiveHidden(baseHidden: boolean, modifiers: RuleModifier[] | undefined, ctx: RuleContext): boolean {
  let hidden = baseHidden;
  for (const m of modifiers ?? []) {
    if (m.field !== 'hidden' || m.type !== 'set') continue;
    if (conditionsHold(m, ctx)) hidden = m.value === true || m.value === 'true';
  }
  return hidden;
}
