# Arena, character and gameplay corrections

- Align the supplied OBJ using its measured inner court: source centre X=-0.165, Z=0.115, floor Y=0.0042; uniform scale 84. Preserve landscape proportions.
- Independently clone and normalize both warriors to 2.2 world units. Canonicalize Mixamo bone names after GLTFLoader sanitization.
- Preserve bind rotations; add a procedural run cycle, relaxed arms, bent knees and hip strike with pose recovery and foot-height correction. These are procedural animations, not newly authored motion-capture clips.
- Preserve the 1024px arena atlas and add shader-based stone grain/relief and roughness. Softer neutral lighting and temple shadows replace the excessive orange cast. No invented replacement texture.
- Solve ring-shot ballistics, use bounded physics substeps, collide against the ring tube, and score once only after the full ball clears the ring.
- Add independent touch aiming, pause/resume, visibility handling and frame-driven goal/countdown transitions.
- Fetch the original character at a pinned commit during prebuild/predev, verify its Git blob hash, and include it in the built site. Runtime no longer needs raw.githubusercontent.com.

## Deployment
The existing Pages workflow fails because GitHub Pages has not been enabled and its token cannot create the site.
A repository administrator must select **Settings > Pages > Build and deployment > Source: GitHub Actions**.
Then merge this change and rerun Deploy playable demo. The code does not broaden token permissions.

## Checks
`npm ci && npm run check && npm run build && npm test`.
The validation workflow also checks Chromium and WebKit at phone portrait and landscape sizes, records shader/runtime errors and captures screenshots.
Actual iPhone hardware performance and final visual approval remain manual checks.
