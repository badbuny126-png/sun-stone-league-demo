# Sun-Stone League Demo

A mobile-first 3D action-sports game inspired by Pok-Ta-Pok and Mesoamerican visual motifs.

## Playable vertical slice

- Solo Challenge: score as many rings as possible in 60 seconds
- 2v2 Team Match: you and an AI teammate face two rival AIs; first team to three rings wins
- Heavy bouncing ball, vertical stone ring, supplied arena, team-aware scoring
- Keyboard/mouse and mobile virtual-joystick controls; pause, resume, and switch modes during a match
- GitHub Pages-compatible Vite build

This is an incremental 2v2 demo. The planned 3v3 roles, combat, and pass-chain systems are not part of this slice.

## Original vision

**MOVE → STRIKE → DEFLECT → CHARGE → COMBAT → SCORE**

The long-term direction is a stylized 3v3 mythic-fantasy sports brawler with Striker, Tank, and Support roles, ability-driven ball play, readable combat, and a cinematic Mesoamerican-inspired arena. The target is stylized rather than historically exact and avoids copyrighted character designs.

## Visual target: honest scope

The supplied concept image is a strong direction for composition, warm sunset lighting, stone architecture, ball energy, readable silhouettes, and broadcast-style UI. Exact AAA fidelity is not realistic for the first free browser demo. Dense crowds, highly detailed character art, bespoke animation, and console-grade VFX require a larger art and optimization pipeline. This repository starts with the gameplay and performance foundation needed to approach that look progressively on iPhone Safari.

## Run

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

## Verify

```bash
npm run check
npm test
npm run build
npm install --no-save --package-lock=false playwright@1.55.0
npx playwright install chromium webkit
node test/browser.mjs
```

The browser suite runs Chromium and WebKit at phone portrait and landscape sizes. Its deterministic ring shots test team scoring and replay; real iPhone Safari performance and visual approval still require the checks in [docs/IPHONE_QA.md](docs/IPHONE_QA.md).

## Publish

A repository administrator must enable **Settings → Pages → Build and deployment → Source: GitHub Actions** once. The deployment workflow cannot create the Pages site with its limited token. After the branch is merged and validation passes, rerun **Deploy playable demo** and verify the resulting public URL on iPhone Safari. See [docs/IPHONE_QA.md](docs/IPHONE_QA.md) for the release checks.
