# Horus Heresy 3rd Edition — List Builder

A web-based army list builder for Warhammer: The Horus Heresy (3rd Edition). Supports all 18 Space Marine Legions, Solar Auxilia, and Mechanicum.

Army data is sourced from the community-maintained [BSData horus-heresy-3rd-edition](https://github.com/BSData/horus-heresy-3rd-edition) repository.

## Features

- Select any of the 18 Space Marine Legions, Solar Auxilia, or Mechanicum
- Build a Crusade force organisation with Primary, Auxiliary, and Apex detachments
- Points tracking against a configurable limit
- Export to plaintext or a `.ros` roster for BattleScribe / New Recruit

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** for bundling
- **Carbon Design System** (`@carbon/react`) for UI components
- **Zustand** for state management
- **Tailwind CSS** for layout utilities

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Sync army data

Downloads and parses the latest BSData JSON files into `data/parsed/`. Requires an internet connection. Pin an upstream version with `BSDATA_REF=<sha> npm run sync-data`, or re-parse already-downloaded files with `npm run sync-data -- --offline`.

```bash
npm run sync-data
```

The raw BSData files are excluded from the repo (they're large). The parsed JSON files (`data/parsed/`) are committed and up to date, so **you only need to run this if you want to pull the latest data from BSData**.

### Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build

```bash
npm run build
```

Output goes to `dist/`.

### Testing

Tests are written with [Vitest](https://vitest.dev/) and validate export XML structure and correctness.

```bash
npm test              # Watch mode (re-run on file changes)
npm test -- --run     # One-time run (CI mode)
npm test:ui           # Open Vitest UI dashboard
```

Current test coverage:
- `src/utils/buildRos.test.ts` — export XML validation (7 tests)
  - XML structure and validity
  - Required attributes (game system, points, roster name)
  - Points calculations
  - XML escaping for special characters
- `scripts/parse-bsdata.test.ts` — BSData parser (13 tests)
  - Points (base + model cost × min, no borrowed upgrade costs)
  - Mandatory/default wargear, including shared groups across catalogues
  - Cross-catalogue units, role/category resolution, faction restrictions

As export enhancements are implemented (required wargear, model profiles, rules), additional tests validate:
- Required items are auto-added based on BSData constraints
- Model profiles include all characteristics
- Weapon/wargear profiles are complete
- Rules and reactions are properly attached

## Data Pipeline

```
BSData GitHub repo (.json files)
        ↓  npm run sync-data
  data/raw/          ← raw BSData JSON (gitignored)
        ↓  parse-bsdata.ts
  data/parsed/       ← units.json + detachments.json (committed)
        ↓  imported at build time
  src/data/loader.ts
```

- `scripts/sync-data.ts` — fetches all catalogues from BSData at a given ref
- `scripts/parse-bsdata.ts` — turns BSData JSON into the app's units/detachments data
- `src/data/factions.ts` — canonical list of factions and display labels
- `src/data/loader.ts` — runtime helpers for filtering units and detachments by faction

## Data Attribution

Army data is sourced from [BSData / horus-heresy-3rd-edition](https://github.com/BSData/horus-heresy-3rd-edition), maintained by the BSData community under the MIT License.

This project is a fan tool and is not affiliated with Games Workshop.
