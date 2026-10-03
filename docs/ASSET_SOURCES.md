# Asset sources

## Warrior

The playable character is vendored at `public/assets/characters/player.glb` (1,947,172 bytes). Original source: `badbuny126-png/-poca-tok-2026`, commit `dec2736cf50d2dd8608ecca3a6d431b1b1d68f9d`, path `public/models/player.glb`. Git blob SHA-1: `45daed454a97e8207ad5f626c2204edd031fbdfa`.

`scripts/prepare-assets.mjs` verifies this local file before development, tests and build. No cross-repository download is needed. The supplied GLB contains a skeleton but no authored animation clips. Procedural IK and poses drive movement and strikes. Vertex pigments color skin, clothing and accessories while retaining bounded source texture detail.

## Arena

The supplied OBJ, material and texture files live under `public/assets/arena/`. `src/arena-layout.js` aligns its inner court with physics coordinates. `src/court.js` adds the goal, procedural stone detail, lighting and a fallback court if the source arena fails to load. The fallback and the supplied model are not displayed simultaneously.

Preserve provenance when replacing models or maps, and measure startup time and GPU cost on the supported iPhones before increasing asset density.
