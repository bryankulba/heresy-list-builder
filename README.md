# Horus Heresy 3rd Edition — List Builder

A web-based army list builder for Warhammer: The Horus Heresy (3rd Edition). Supports all 18 Space Marine Legions, Solar Auxilia, and Mechanicum.

Army data is sourced from the community-maintained [BSData horus-heresy-3rd-edition](https://github.com/BSData/horus-heresy-3rd-edition) repository.

## Features

- Select any of the 18 Space Marine Legions, Solar Auxilia, or Mechanicum
- Build a Crusade force organisation with Primary, Auxiliary, and Apex detachments
- Points tracking against a configurable limit
- Export list to plaintext

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

Downloads and parses the latest `.cat`/`.gst` files from BSData into `data/parsed/`. Requires an internet connection.

```bash
npm run sync-data
```

The raw XML files are excluded from the repo (they're large). The parsed JSON files (`data/parsed/`) are committed and up to date, so **you only need to run this if you want to pull the latest data from BSData**.

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

## Data Pipeline

```
BSData GitHub repo (.gst + .cat files)
        ↓  npm run sync-data
  data/raw/          ← raw XML (gitignored)
        ↓  parse-cats.ts
  data/parsed/       ← units.json + detachments.json (committed)
        ↓  imported at build time
  src/data/loader.ts
```

- `scripts/sync-data.ts` — fetches all faction catalogs from BSData
- `scripts/parse-cats.ts` — regex-based XML parser (no DOM dependency; handles multi-MB files)
- `src/data/factions.ts` — canonical list of factions and display labels
- `src/data/loader.ts` — runtime helpers for filtering units and detachments by faction

## Data Attribution

Army data is sourced from [BSData / horus-heresy-3rd-edition](https://github.com/BSData/horus-heresy-3rd-edition), maintained by the BSData community under the MIT License.

This project is a fan tool and is not affiliated with Games Workshop.
