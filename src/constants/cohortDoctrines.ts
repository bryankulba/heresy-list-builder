export interface CohortDoctrine {
  id: string;
  name: string;
  /** Display name of the tercio detachment boosted by this doctrine */
  boostedTercio: string;
}

export const COHORT_DOCTRINES: CohortDoctrine[] = [
  { id: 'ultima-pattern',        name: 'Ultima Pattern Cohort',        boostedTercio: 'Infantry Tercio' },
  { id: 'solar-pattern',         name: 'Solar Pattern Cohort',         boostedTercio: 'Veletaris Tercio' },
  { id: 'mechanised-pattern',    name: 'Mechanised Pattern Cohort',    boostedTercio: 'Armour Tercio' },
  { id: 'siege-pattern',         name: 'Siege Pattern Cohort',         boostedTercio: 'Artillery Tercio' },
  { id: 'reconnaissance-pattern', name: 'Reconnaissance Pattern Cohort', boostedTercio: 'Scout Tercio' },
  { id: 'iron-pattern',          name: 'Iron Pattern Cohort',          boostedTercio: 'Iron Tercio' },
];

export const COHORT_DOCTRINE_BY_ID: Record<string, CohortDoctrine> = Object.fromEntries(
  COHORT_DOCTRINES.map((d) => [d.id, d])
);
