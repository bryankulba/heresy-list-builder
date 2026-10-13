/**
 * useRosterView.ts
 * Everything the canvas derives from the roster and its army settings: the
 * counts every BSData rule check uses, the detachments as shown (effective
 * slot counts, without roles the army can't fill) and the roster warnings.
 */

import { useMemo } from 'react';
import { useRosterStore } from '../../store/rosterStore';
import { allDetachments } from '../../store/rosterModel';
import { rosterCounts } from '../../rules/context';
import { withEffectiveSlots } from '../../rules/slots';
import { fillableSlots } from '../../rules/options';
import { validateRoster, type RosterWarning } from '../../rules/validate';

export function useRosterView() {
  const forces = useRosterStore((s) => s.forces);
  const allegiance = useRosterStore((s) => s.allegiance);
  const pointsLimit = useRosterStore((s) => s.pointsLimit);
  const cohortDoctrine = useRosterStore((s) => s.cohortDoctrine);
  const configChoices = useRosterStore((s) => s.configChoices);

  // Memoized: the connector-line layout effect depends on this array's identity
  const detachments = useMemo(() => allDetachments(forces), [forces]);
  // What the army's configuration contributes to every BSData rule check
  const rosterOpts = useMemo(
    () => ({ allegiance, pointsLimit, cohortDoctrine, configChoices }),
    [allegiance, pointsLimit, cohortDoctrine, configChoices]
  );
  const counts = useMemo(() => rosterCounts(forces, rosterOpts), [forces, rosterOpts]);
  // Detachments as shown: slot counts evaluated from their contents, without
  // slot roles no unit of the army can fill (e.g. Skitarii Transport)
  const view = useMemo(
    () =>
      withEffectiveSlots(forces, counts).map((force) => ({
        ...force,
        detachments: force.detachments.map((det) => ({
          ...det,
          def: { ...det.def, slots: fillableSlots(forces, force, det, counts) },
        })),
      })),
    [forces, counts]
  );
  const viewDetachments = useMemo(() => allDetachments(view), [view]);
  // Roster warnings (never blocking), by detachment for the cards' badges
  const warnings = useMemo(() => validateRoster({ forces, ...rosterOpts }), [forces, rosterOpts]);
  const warningsByDetachment = useMemo(() => {
    const map = new Map<string, RosterWarning[]>();
    for (const w of warnings) if (w.detachmentId) map.set(w.detachmentId, [...(map.get(w.detachmentId) ?? []), w]);
    return map;
  }, [warnings]);

  return { forces, allegiance, pointsLimit, detachments, counts, view, viewDetachments, warnings, warningsByDetachment };
}

export type RosterView = ReturnType<typeof useRosterView>;
