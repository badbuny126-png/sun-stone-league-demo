# Lost Courts Expansion — Incremental Roadmap

## Preservation contract

- Keep the existing Three.js + Vite application and current main gameplay intact.
- Preserve the supplied arena model, ball physics/scoring, character GLB, Solo Challenge, 1v1, AI, keyboard/mouse and mobile touch controls.
- Develop on feature/lost-courts-jungle-prototype; merge only after tests and browser checks pass.
- New gameplay systems must be modular and must not introduce a backend or paid dependency.

## Current verified baseline

- src/main.js owns the existing match loop, menu, camera, scoring and AI.
- src/ball.js, src/court.js, src/characters.js, src/input.js and src/shot.js are existing gameplay modules.
- The app uses Three.js 0.163 and Vite 5; npm test, npm run check, and npm run build are existing validation commands.
- The supplied arena is an OBJ with three WebP material maps. The player GLB is referenced by the character loader.
- The repository has GitHub Pages deployment and validation workflows.

## Milestone 1 — Jungle exploration prototype

- Add a separate adventure entry point; do not replace arena modes.
- Build one deterministic 120 × 120 jungle region with instanced trees, rocks, a river, a ruin landmark and collectible resource nodes.
- Add keyboard/touch-compatible movement, proximity harvesting, a small resource HUD and local save/restore.
- Add unit tests for deterministic world placement and one-time harvesting.

## Subsequent milestones

1. Replace placeholder geometry progressively with license-verified GLB/GLTF environment assets.
2. Add inventory capacity, item definitions, crafting recipes and tests.
3. Add farming plots, construction placement and versioned world saves.
4. Add NPC interaction, dialogue, quest state and the first playable Lost Courts chapter.
5. Add distinct arena layouts, training challenges and tournament progression.
6. Add audio, weather, day/night, effects, mobile profiling and deployment verification.

## Asset policy

No third-party asset is imported by the initial prototype. Geometry and materials are original procedural placeholders. Record source URL, author, license, attribution and modifications before adding each external asset.
