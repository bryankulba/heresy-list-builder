/**
 * rosterModel.ts
 * Pure functions over the roster's forces — no React, no Zustand — so the
 * store, export and tests share one implementation.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DetachmentDef,
  FilledSlot,
  Force,
  ForceKind,
  PlacedDetachment,
  RosterSnapshot,
  RosterSnapshotV1,
  UnitEntry,
} from '../types';
import { ALLIED_CHART, ALLIED_DETACHMENT, CRUSADE_CHART, FACTION_BY_ID } from '../data/factions';
import { detachmentsData, getChartDetachment, getUnitsForFaction, unitVariant } from '../data/loader';

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function makePlacedDetachment(def: DetachmentDef, unlockedBy?: string): PlacedDetachment {
  return { id: uuidv4(), def, slots: {}, unlockedBy };
}

/** A new force with its chart's primary detachment (or the Allied Detachment) already placed. */
export function createForce(faction: string, kind: ForceKind): Force {
  const factionDef = FACTION_BY_ID[faction];
  if (!factionDef) throw new Error(`Unknown faction "${faction}"`);
  const chart = kind === 'allied' ? ALLIED_CHART : factionDef.chart;
  const rootName = kind === 'allied' ? ALLIED_DETACHMENT : factionDef.primaryDetachment;
  return {
    id: uuidv4(),
    faction,
    kind,
    chart,
    detachments: [makePlacedDetachment(getChartDetachment(chart, rootName))],
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function allDetachments(forces: Force[]): PlacedDetachment[] {
  return forces.flatMap((f) => f.detachments);
}

export function primaryForce(forces: Force[]): Force | undefined {
  return forces.find((f) => f.kind === 'primary');
}

export function findForceOfDetachment(forces: Force[], detachmentId: string): Force | undefined {
  return forces.find((f) => f.detachments.some((d) => d.id === detachmentId));
}

/** Faction of the force containing a detachment (or of a "detId::slotKey" unlock reference). */
export function factionOfDetachment(forces: Force[], detachmentIdOrRef: string): string {
  const detId = detachmentIdOrRef.split('::')[0];
  return findForceOfDetachment(forces, detId)?.faction ?? primaryForce(forces)?.faction ?? '';
}

function slotPoints(fs: FilledSlot | null | undefined): number {
  return fs ? fs.unit.points + (fs.extraPoints ?? 0) : 0;
}

export function detachmentPoints(det: PlacedDetachment): number {
  const slots = Object.values(det.slots).reduce((sum, fs) => sum + slotPoints(fs), 0);
  const bonus = (det.bonusSlots ?? []).reduce(
    (sum, bs) => sum + (bs.unit ? bs.unit.points + (bs.extraPoints ?? 0) : 0),
    0
  );
  return slots + bonus;
}

export function computeTotalPoints(forces: Force[]): number {
  return allDetachments(forces).reduce((total, det) => total + detachmentPoints(det), 0);
}

// ---------------------------------------------------------------------------
// Updates (all return new arrays)
// ---------------------------------------------------------------------------

export function updateDetachment(
  forces: Force[],
  detachmentId: string,
  update: (det: PlacedDetachment) => PlacedDetachment
): Force[] {
  return forces.map((f) =>
    f.detachments.some((d) => d.id === detachmentId)
      ? { ...f, detachments: f.detachments.map((d) => (d.id === detachmentId ? update(d) : d)) }
      : f
  );
}

/**
 * Adds a detachment. An unlocked detachment joins the force of the slot that
 * unlocked it; otherwise it joins `forceId` (default: the primary force).
 */
export function addDetachment(
  forces: Force[],
  def: DetachmentDef,
  opts: { unlockedBy?: string; forceId?: string } = {}
): Force[] {
  const target = opts.unlockedBy
    ? findForceOfDetachment(forces, opts.unlockedBy.split('::')[0])
    : forces.find((f) => f.id === opts.forceId) ?? primaryForce(forces);
  if (!target) return forces;
  const placed = makePlacedDetachment(def, opts.unlockedBy);
  return forces.map((f) => (f.id === target.id ? { ...f, detachments: [...f.detachments, placed] } : f));
}

/** Removes a detachment and, recursively, every detachment unlocked by one of its slots. */
export function removeDetachmentCascade(forces: Force[], detachmentId: string): Force[] {
  const all = allDetachments(forces);
  const doomed = new Set<string>();
  const collect = (id: string) => {
    doomed.add(id);
    for (const det of all) {
      if (det.unlockedBy?.startsWith(`${id}::`) && !doomed.has(det.id)) collect(det.id);
    }
  };
  collect(detachmentId);
  return forces.map((f) => ({ ...f, detachments: f.detachments.filter((d) => !doomed.has(d.id)) }));
}

// ---------------------------------------------------------------------------
// Persistence: migration and data refresh
// ---------------------------------------------------------------------------

/** schemaVersion 1 (single faction, flat detachments) → forces. */
export function migrateV1(v1: RosterSnapshotV1): RosterSnapshot {
  return {
    allegiance: v1.allegiance,
    pointsLimit: v1.pointsLimit,
    cohortDoctrine: v1.cohortDoctrine ?? '',
    forces: [
      {
        id: uuidv4(),
        faction: v1.faction,
        kind: 'primary',
        chart: FACTION_BY_ID[v1.faction]?.chart ?? CRUSADE_CHART,
        detachments: v1.detachments ?? [],
      },
    ],
  };
}

/** Accepts any saved/persisted roster shape and returns the current one. */
export function migrateSnapshot(raw: unknown): RosterSnapshot {
  const r = raw as Partial<RosterSnapshot> & Partial<RosterSnapshotV1>;
  if (Array.isArray(r.forces)) {
    return {
      allegiance: r.allegiance ?? 'Loyalist',
      pointsLimit: r.pointsLimit ?? 3000,
      cohortDoctrine: r.cohortDoctrine ?? '',
      forces: r.forces,
    };
  }
  return migrateV1(r as RosterSnapshotV1);
}

/** The current definition of a stored detachment (by entryId, then name), or the stored one if gone. */
function freshDetachmentDef(def: DetachmentDef): DetachmentDef {
  const all = detachmentsData.charts.flatMap((c) => c.detachments);
  return (
    (def.entryId ? all.find((d) => d.entryId === def.entryId) : undefined) ??
    all.find((d) => d.name === def.name) ??
    def
  );
}

/**
 * Replaces stored unit and detachment snapshots with the current data, so
 * saved lists pick up points/wargear/slot-rule fixes from newer BSData syncs.
 * Units match on entryId, then name + role (entryIds can change when BSData
 * relinks a unit). Anything no longer in the data is kept as saved.
 */
export function refreshUnits(forces: Force[]): Force[] {
  return forces.map((force) => {
    const current = getUnitsForFaction(force.faction);
    const byId = new Map(current.map((u) => [u.entryId, u]));
    for (const u of current) {
      for (const alt of u.alternateLinks ?? []) if (!byId.has(alt.entryId)) byId.set(alt.entryId, unitVariant(u, alt));
    }
    const fresh = (unit: UnitEntry): UnitEntry =>
      (unit.entryId ? byId.get(unit.entryId) : undefined) ??
      current.find((u) => u.name === unit.name && u.role === unit.role) ??
      unit;

    return {
      ...force,
      detachments: force.detachments.map((det) => ({
        ...det,
        def: freshDetachmentDef(det.def),
        slots: Object.fromEntries(
          Object.entries(det.slots).map(([key, fs]) => [key, fs ? { ...fs, unit: fresh(fs.unit) } : fs])
        ),
        bonusSlots: det.bonusSlots?.map((bs) => (bs.unit ? { ...bs, unit: fresh(bs.unit) } : bs)),
      })),
    };
  });
}
