export type Allegiance = 'Loyalist' | 'Traitor';
export type AppPhase = 'start' | 'canvas';
export type DetachmentType = 'core' | 'auxiliary' | 'apex' | 'allied' | 'additional' | 'other';

export interface WargearEntry {
  name: string;
  entryId: string;
}

export interface ModelEntry {
  name: string;
  entryId?: string;
  cost: number;
  min: number;
  max: number;
  defaultWargear?: WargearEntry[];
}

export interface UnitEntry {
  name: string;
  entryId?: string;
  role: string;
  /** Full primary category incl. any qualifier, e.g. "Support - Castellax Battle Maniple Only". Absent on units saved before 2026-10. */
  primaryCategory?: string;
  points: number;
  baseCost: number;
  models: ModelEntry[];
  source: string;
  /** Mandatory unit-level wargear (grenades, boarding shields, etc.) to emit in the .ros export */
  unitWargear?: WargearEntry[];
  /** Number of auxiliary detachments this unit unlocks in a Command slot (default 1). Derived from BSData "Officer of the Line (N)" category. */
  officerOfTheLine?: number;
  /** Entry/category ids the unit contains at default composition, with counts (for rule conditions) */
  facts?: Record<string, number>;
  /** The unit's "Prime Unit" link and the Prime benefit group(s) it offers */
  prime?: { linkId: string; groups: string[] };
}

export interface SlotDef {
  role: string;
  min: number;
  max: number;
  prime: boolean;
  categoryId?: string;
}

export interface DetachmentDef {
  name: string;
  entryId?: string;
  type: string;
  slots: SlotDef[];
  /** Faction keys that can field this detachment (empty = available to all / unknown) */
  sources?: string[];
}

export interface PrimeBenefit {
  id: string;
  name: string;
  description: string;
}

export interface FilledSlot {
  unit: UnitEntry;
  primeBenefit?: PrimeBenefit;
  notes?: string;
  extraPoints?: number;
}

/** A bonus slot added to a detachment card by the Logistical Benefit prime benefit. */
export interface BonusSlot {
  id: string;             // uuid
  sourceSlotKey: string;  // the prime slot key that created this bonus slot
  role: string;           // role chosen by the user
  unit: UnitEntry | null;
  notes?: string;
  extraPoints?: number;
}

export interface PlacedDetachment {
  id: string; // uuid
  def: DetachmentDef;
  // key: "${role}-${index}", e.g. "Troops-0", "Troops-1"
  slots: Record<string, FilledSlot | null>;
  // "${detachmentId}::${slotKey}" — includes detachment id to avoid cross-detachment collisions
  unlockedBy?: string;
  bonusSlots?: BonusSlot[];
}

export type ForceKind = 'primary' | 'allied';

/**
 * One army within the roster — mirrors a root <force> in a .ros file: a
 * catalogue (faction), the force org chart it's built on, and its detachments
 * (the chart's child forces).
 */
export interface Force {
  id: string; // uuid
  faction: string;
  kind: ForceKind;
  /** Root force entry (chart) name, e.g. "Crusade Force Organization Chart" */
  chart: string;
  detachments: PlacedDetachment[];
}

/** Everything needed to restore a roster. */
export interface RosterSnapshot {
  allegiance: Allegiance;
  pointsLimit: number;
  cohortDoctrine: string;
  forces: Force[];
}

export interface SavedList extends RosterSnapshot {
  id: string;
  name: string;
  savedAt: number;          // Date.now()
  schemaVersion: number;
}

/** Saved roster shape before forces/allies (schemaVersion 1). */
export interface RosterSnapshotV1 {
  faction: string;
  allegiance: Allegiance;
  pointsLimit: number;
  cohortDoctrine: string;
  detachments: PlacedDetachment[];
}

export type ModalState =
  | { type: 'none' }
  | { type: 'slotEdit'; detachmentId: string; slotKey: string; slotDef: SlotDef; filled: FilledSlot }
  | { type: 'unitPicker'; detachmentId: string; slotKey: string; role: string; slotRole: string; isPrime?: boolean }
  | { type: 'primeBenefit'; detachmentId: string; slotKey: string; role: string; unit: UnitEntry }
  | { type: 'bonusSlotRoleSelector'; detachmentId: string; slotKey: string; role: string; unit: UnitEntry; roles?: string[] }
  | { type: 'bonusUnitPicker'; detachmentId: string; bonusSlotId: string; role: string }
  | { type: 'detachmentSelector'; trigger: 'highCommand' | 'command'; unlockedBy: string; title?: string }
  | { type: 'allySelector' }
  | { type: 'additionalDetachmentSelector' }
  | { type: 'confirmRemoveForce'; forceId: string }
  | { type: 'confirmClear'; detachmentId: string; slotKey: string; affectedIds: string[] }
  | { type: 'export' }
  | { type: 'saveLoad' }
  | { type: 'confirmReset' };
