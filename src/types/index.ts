import type { RuleModifier } from '../rules/evaluate';

export type Allegiance = 'Loyalist' | 'Traitor';
export type AppPhase = 'start' | 'canvas';
export type DetachmentType = 'core' | 'auxiliary' | 'apex' | 'allied' | 'additional' | 'other';

/** Paths are .ros selection entryIds ("::"-joined, see scripts/parse-bsdata.ts). Absent on units saved before 2026-10. */
export interface WargearEntry {
  name: string;
  entryId: string;
  /** How many come per parent selection, when more than one (a pair of sponson weapons) */
  count?: number;
  targetId?: string;
  path?: string;
  groupPath?: string;
  children?: WargearEntry[];
}

export interface ModelEntry {
  name: string;
  entryId?: string;
  path?: string;
  /** 'unit' for nested sub-units (e.g. Rapier crews) */
  kind?: 'model' | 'unit';
  models?: ModelEntry[];
  cost: number;
  min: number;
  max: number;
  defaultWargear: WargearEntry[];
}

export interface UnitEntry {
  name: string;
  /** Root link id — the unit's identity */
  entryId?: string;
  /** .ros selection entryId (root link :: shared entry) */
  path?: string;
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
  /** The unit's "Prime Unit" link (and .ros path), its Prime benefit groups and their path prefixes */
  prime?: { linkId: string; path?: string; groups: string[]; groupPrefixes?: Record<string, string> };
  /** High Command detachment-choice paths ("One Apex / One Auxiliary Detachment") */
  detachmentChoice?: { prefix: string; groupId: string };
  /** Conditional re-filings of the primary category (e.g. "Heavy Assault - Tartaros Only" in a Linebreaker) */
  primaryCategoryRules?: Array<{ category: string } & Pick<RuleModifier, 'conditions' | 'conditionGroups'>>;
  /** Other root links to the same unit under different primary categories (see unitVariant) */
  alternateLinks?: Array<{ entryId: string; category: string; categoryIds?: string[] }>;
  /** Categories the unit's root link gives it (swapped for an alternate link's in unitVariant) */
  linkCategoryIds?: string[];
  /** Hidden in BSData unless modifiers show it */
  hidden?: boolean;
  /** Its (and its root link's) hidden modifiers — e.g. Sevatar is hidden when the roster is Loyalist */
  visibility?: RuleModifier[];
  /** At most this many in the whole roster (unique characters: 1) */
  rosterMax?: number;
}

export interface SlotDef {
  role: string;
  min: number;
  max: number;
  prime: boolean;
  categoryId?: string;
  /** BSData modifiers on the slot's max — evaluated by rules/slots.ts effectiveSlots */
  maxModifiers?: RuleModifier[];
  /** Shown only when these allow (e.g. "Clade Operative" slots once the Clade Operative benefit is taken) */
  hidden?: boolean;
  visibility?: RuleModifier[];
}

export interface DetachmentDef {
  name: string;
  entryId?: string;
  /** Set when the chart links the detachment from another chart (Zone Mortalis → Crusade Auxiliaries) */
  linkId?: string;
  type: string;
  slots: SlotDef[];
  /** Faction keys that can field this detachment (empty = available to all / unknown) */
  sources?: string[];
  /** What it uses of its chart's detachment limits, by cost type id — see rules/detachmentLimits.ts */
  costs?: Record<string, number>;
  /** Modifiers on those costs (a Tercio counts as half an Auxiliary detachment with its cohort doctrine) */
  costModifiers?: Record<string, RuleModifier[]>;
  /** How many the roster may contain, raised by modifiers (Knight Additional detachments) */
  rosterMax?: { max: number; modifiers: RuleModifier[] };
  /** BSData error messages and when they apply ("Storm Battery Detachment requires a Siege Breaker") */
  errors?: Array<{ message: string } & Pick<RuleModifier, 'conditions' | 'conditionGroups'>>;
}

export interface PrimeBenefit {
  id: string;
  name: string;
  description: string;
}

export interface FilledSlot {
  unit: UnitEntry;
  primeBenefit?: PrimeBenefit;
  /** Logistical Benefit: the role of the extra slot it adds to the detachment ("Armour") */
  lbRole?: string;
  /**
   * Whether the unit is Prime. Unset = Prime exactly when it sits in a Prime
   * position. Set explicitly by .ros import, where a unit can fill a Prime
   * position without being Prime, or be Prime without a benefit chosen yet.
   */
  isPrime?: boolean;
  /** Detachment-choice marks carried over from an imported roster ("One Apex / Auxiliary Detachment") */
  detachmentChoices?: Array<'apex' | 'auxiliary'>;
  /** Models of each type, by `modelKey`, where it differs from the minimum (unit size) */
  modelCounts?: Record<string, number>;
  notes?: string;
  extraPoints?: number;
}

/** @deprecated Saved lists only: Logistical Benefit's old app-managed slot (migrated by `migrateBonusSlots`). */
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

/** primary army, an allied army, or a Lord of War Detachment (its own root force in a .ros) */
export type ForceKind = 'primary' | 'allied' | 'lordOfWar';

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
  /**
   * Per-unit BSData choices made once for the army (a Skitarii/Mechanicum
   * unit's sub-faction): choice group id → option id. See rules/armyChoices.ts
   */
  armyChoices?: Record<string, string>;
  /** Army settings from BSData's army configuration (Rite of War, Household Paradigms…): entry name → choice */
  configChoices?: Record<string, string>;
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
  | { type: 'unitPicker'; detachmentId: string; slotKey: string; role: string; isPrime?: boolean }
  | { type: 'primeBenefit'; detachmentId: string; slotKey: string; role: string; unit: UnitEntry }
  | { type: 'bonusSlotRoleSelector'; detachmentId: string; slotKey: string; role: string; unit: UnitEntry; roles?: string[] }
  | { type: 'detachmentSelector'; trigger: 'highCommand' | 'command'; unlockedBy: string; title?: string }
  | { type: 'allySelector' }
  | { type: 'additionalDetachmentSelector' }
  | { type: 'confirmRemoveForce'; forceId: string }
  | { type: 'confirmRemoveDetachment'; detachmentId: string }
  | { type: 'confirmClear'; detachmentId: string; slotKey: string; affectedIds: string[] }
  | { type: 'export' }
  | { type: 'saveLoad' }
  | { type: 'confirmReset' };
