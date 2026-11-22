# Chronicle

Chronicle is the next, local-first workbench for Fantasy Map Maker. It is meant for worldbuilding and planning a Fire Emblem-style project, not editing ROMs. This milestone runs alongside the original atlas rather than replacing it.

## Run

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates the static site in `dist/`; serve it over HTTP (for example, `npm run preview`). No login or backend is needed.

## Try the historical demo

1. Start with the editable **Sundering of Avelorn**. In Map Editor, inspect **Ashgate Pass** in Year 100.
2. Click a Year 105 event. The pass changes to Draken, Cedric defects, and the Relationship Web shows distrust. In Year 110, Valoria retakes the pass and Arthur becomes a General.
3. Visit Year 115. Cedric is deceased; toggle deceased characters in the graph to show him. Browse Diplomacy to see the Valoria–Elysia treaty.
4. Edit an existing event, then revisit an earlier and later date. **Record at Year** makes a dated change; **Edit baseline** changes the underlying record and may affect all dates.
5. Add a location or draw a territory. Export a backup and import it as a separate world to compare. Use World Settings to add or remove the sample.

## What is in this build

- Multiple editable worlds, IndexedDB autosave, JSON export/import, and undo/redo.
- An independent timeline engine with stable IDs, date-effective changes, ordered same-date events, validation warnings, and a date shared across the map, rosters, and graphs.
- Terrain brushes, erasing, editable territory polygons, settlement and army markers, map layers, PNG/JPEG/SVG reference images, and SVG map export.
- Kingdom, character, location, army, and territory records; editable historical events; historical relationship and diplomacy graphs with directional links and persistent layout.
- This milestone does not yet include a full chapter/class promotion editor, detailed war/battle records, simulation, a rich-text Codex, or CSV/PNG exports. Map dimensions, calendar rules, and high-volume performance also have room for follow-up. No claim of direct ROM integration.

## Upgrade an existing map

First open your original Fantasy Map Maker **in the same browser and at the same address you used before**, click **Export world**, and keep a copy of that JSON. Then use **Import** in Chronicle. If the old atlas shared this exact browser origin, Chronicle can also copy its save on first launch. Chronicle never overwrites the original storage key. The original application remains in the repository root and is also bundled under `legacy/` for convenience. Browser saves are origin-specific, so use JSON to carry worlds between addresses, devices, or branches.

## Verify

```sh
npm test
npm run build
```

Tests cover historical projections, moving/deleting older events, date ordering, life and allegiance, territory and armies, validation, older backups, IndexedDB saves, and the map/graph workbench in a simulated DOM. A real-device touch and pointer pass is still recommended before a release.
