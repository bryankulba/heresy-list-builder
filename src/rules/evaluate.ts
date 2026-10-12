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

export interface RuleModifier {
  type: string;
  field: string;
  value: string | number | boolean;
  conditions?: RuleCondition[];
  conditionGroups?: RuleConditionGroup[];
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
      // The unit itself (and its categories), its detachment, chart and catalogue
      return isInForce(ctx, id) || (ctx.unit[id] ?? 0) > 0;
    case 'unit':
    case 'self':
    case 'parent':
      return (ctx.unit[id] ?? 0) > 0;
    default:
      return false;
  }
}

function count(c: RuleCondition, ctx: RuleContext): number {
  const id = c.childId ?? '';
  if (c.field === 'forces') return ctx.rosterForces[id] ?? 0;
  if (c.field !== 'selections') return 0; // cost/limit fields aren't modelled
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

/** Applies `set hidden` modifiers in order to a base hidden flag. */
export function effectiveHidden(baseHidden: boolean, modifiers: RuleModifier[] | undefined, ctx: RuleContext): boolean {
  let hidden = baseHidden;
  for (const m of modifiers ?? []) {
    if (m.field !== 'hidden' || m.type !== 'set') continue;
    if (conditionsHold(m, ctx)) hidden = m.value === true || m.value === 'true';
  }
  return hidden;
}
