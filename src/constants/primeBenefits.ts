import type { PrimeBenefit } from '../types';

export const PRIME_BENEFITS: PrimeBenefit[] = [
  {
    id: 'master-sergeant',
    name: 'Master Sergeant',
    description:
      'The prime unit gains a Veteran Sergeant upgrade at no additional cost, improving its Leadership and combat capability.',
  },
  {
    id: 'combat-veterans',
    name: 'Combat Veterans',
    description:
      'The prime unit gains the Combat Veterans special rule, improving its Ld, Cl, Wp, and In characteristics by 1 (to a maximum of 10).',
  },
  {
    id: 'paragon-of-battle',
    name: 'Paragon of Battle',
    description:
      'The prime unit gains +1 Attack and +1 to its WS characteristic, representing elite warriors at the peak of their abilities.',
  },
  {
    id: 'special-assignment',
    name: 'Special Assignment',
    description:
      'The prime unit may be placed in reserve and deployed using the Flanking special rule, regardless of normal restrictions.',
  },
  {
    id: 'logistical-benefit',
    name: 'Logistical Benefit',
    description:
      'Add one bonus unit of the same battlefield role to this detachment. The bonus unit is added as an additional slot on this card.',
  },
  {
    id: 'legion-specific',
    name: 'Legion Specific',
    description:
      "The prime unit gains a special rule specific to its legion, as detailed in the legion's army list entry.",
  },
];
