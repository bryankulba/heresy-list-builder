export type Allegiance = 'Loyalist' | 'Traitor';
export type AppPhase = 'start' | 'canvas';
export type DetachmentType = 'core' | 'auxiliary' | 'apex' | 'other';

export interface ModelEntry {
  name: string;
  entryId?: string;
  cost: number;
  min: number;
  max: number;
}

export interface UnitEntry {
  name: string;
  entryId?: string;
  role: string;
  points: number;
  baseCost: number;
  models: ModelEntry[];
  source: string;
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
}

/** A bonus slot added to a detachment card by the Logistical Benefit prime benefit. */
export interface BonusSlot {
  id: string;             // uuid
  sourceSlotKey: string;  // the prime slot key that created this bonus slot
  role: string;           // role chosen by the user
  unit: UnitEntry | null;
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

export type ModalState =
  | { type: 'none' }
  | { type: 'slotEdit'; detachmentId: string; slotKey: string; slotDef: SlotDef; filled: FilledSlot }
  | { type: 'unitPicker'; detachmentId: string; slotKey: string; role: string; isPrime?: boolean }
  | { type: 'primeBenefit'; detachmentId: string; slotKey: string; role: string; unit: UnitEntry }
  | { type: 'bonusSlotRoleSelector'; detachmentId: string; slotKey: string; role: string; unit: UnitEntry }
  | { type: 'bonusUnitPicker'; detachmentId: string; bonusSlotId: string; role: string }
  | { type: 'detachmentSelector'; trigger: 'highCommand' | 'command'; unlockedBy: string }
  | { type: 'lordOfWarSelector' }
  | { type: 'confirmClear'; detachmentId: string; slotKey: string; affectedIds: string[] }
  | { type: 'export' };
