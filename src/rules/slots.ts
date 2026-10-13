/**
 * slots.ts
 * Which units can fill a slot, following BattleScribe's model: a slot counts
 * units by primary category, and BSData re-files units into qualified
 * categories depending on where they are placed (e.g. Tartaros Terminators
 * become "Heavy Assault - Tartaros Only" inside a Linebreaker Echelon
 * (Tartaros)).
 */

import type { Force, PlacedDetachment, SlotDef, UnitEntry } from '../types';
import { getBaseRole, getUnitsForFaction, stripPrimePrefix, unitVariant } from '../data/loader';
import { applyNumericModifiers, conditionsHold, type RuleContext } from './evaluate';
import { detachmentContext, rosterCounts, unitContext, type RosterCounts } from './context';

/** The unit's primary category where `ctx` places it. */
export function effectivePrimaryCategory(unit: UnitEntry, ctx: RuleContext): string {
  let category = unit.primaryCategory ?? unit.role;
  for (const rule of unit.primaryCategoryRules ?? []) {
    if (conditionsHold(rule, ctx)) category = rule.category;
  }
  return category;
}

/**
 * Does a unit with primary category `category` fill a slot with role `slotRole`
 * in a detachment whose slots are `detachmentRoles`?
 *  - Regular slots match the category exactly ("Troops", "Troops - Tzeench only").
 *  - Prime slots ("Prime Heavy Assault") take units of the base role, including
 *    a qualified variant that has its own slot in the detachment
 *    ("Heavy Assault - Tartaros Only" in a Linebreaker Echelon).
 */
export function categoryFitsSlot(category: string, slotRole: string, detachmentRoles: string[]): boolean {
  if (!slotRole.startsWith('Prime ')) return category === slotRole;
  const base = stripPrimePrefix(slotRole);
  if (category === base) return true;
  return getBaseRole(category) === getBaseRole(base) && detachmentRoles.includes(category);
}

/**
 * Units that can fill `slot` of `detachment` in `force`: those whose primary
 * category there fits the slot, or that have an alternate root link that does
 * (returned as that variant, so they export with the right link).
 */
export function unitsForSlot(
  forces: Force[],
  force: Force,
  detachment: PlacedDetachment,
  slot: SlotDef,
  counts: RosterCounts = rosterCounts(forces)
): UnitEntry[] {
  const candidates = getUnitsForFaction(force.faction);
  const roles = detachment.def.slots.map((s) => s.role);
  return candidates.flatMap((u): UnitEntry[] => {
    const ctx = unitContext(forces, force, detachment, u, slot.categoryId, counts);
    if (categoryFitsSlot(effectivePrimaryCategory(u, ctx), slot.role, roles)) return [u];
    const alt = u.alternateLinks?.find((l) => categoryFitsSlot(l.category, slot.role, roles));
    return alt ? [unitVariant(u, alt)] : [];
  });
}

/**
 * The detachment's slots with each max evaluated against what the detachment
 * (and roster) contains — e.g. a legion rule making every Troops slot Prime, or
 * Logisticae opening Transport slots. Slots evaluated to 0 are dropped.
 */
export function effectiveSlots(
  forces: Force[],
  force: Force,
  detachment: PlacedDetachment,
  counts: RosterCounts = rosterCounts(forces)
): SlotDef[] {
  const ctx = detachmentContext(forces, force, detachment, counts);
  return detachment.def.slots
    .map((slot) => (slot.maxModifiers ? { ...slot, max: applyNumericModifiers(slot.max, slot.maxModifiers, ctx) } : slot))
    .filter((slot) => slot.max > 0);
}

/** Forces whose placed detachments carry their effective slots (for rendering and layout). */
export function withEffectiveSlots(forces: Force[], counts: RosterCounts = rosterCounts(forces)): Force[] {
  return forces.map((force) => ({
    ...force,
    detachments: force.detachments.map((det) => ({
      ...det,
      def: { ...det.def, slots: effectiveSlots(forces, force, det, counts) },
    })),
  }));
}
