# Playable demo improvements

## Implemented in PR #5

- Measured two-bone leg IK, speed-paced foot cycles, grounded stance feet, bent knees, torso counter-rotation and relaxed arms. Wrists and fingers participate in movement and strikes.
- Hip strikes have anticipation, contact and recovery. The ball impulse happens at contact, with a second range check so a missed swing does not strike a distant ball.
- Skin, teal/crimson clothing, gold accessories and colored feathers replace the dark team tint. The original map provides bounded surface detail.
- World-scale masonry on court walls, fine floor pores and relief, warmer directional light, cool fill and distance haze.
- Fixed particle pool for dust and impact sparks, expanding shockwaves, smoother starts/stops and turns, and an illuminated strike button when in range.
- Camera framing includes the player, ball and scoring ring in both phone orientations.
- AI fighters steer away from nearby bodies and the support fighter leaves space when a teammate contests the ball. An in-range dashed shot guide uses the same bounce/rim physics as the game; it predicts a strike from the ball's current position and cannot account for movement during windup or a later opponent strike.

- Charge-and-release Hip / Elbow / Knee, angle and momentum-dependent impulses, manual aiming on Hard, simultaneous possession contests, collisions, passing, deflection and shoulder charges.
- One-bounce rallies, opposing back zones, distinct wall-surface combos, kinetic pass chains, first-to-20/timed matches and tied sudden death.
- Practice, three difficulties, escalating solo ring motion/obstacles/multipliers, saved solo best/match stats and an Amber outfit unlock. See [playable rules](PLAYABLE_RULES.md).
- Seeded match random decisions, separate match/AI/strike/profile modules and a verified vendored character asset. Main remains the scene/input coordinator; height bands approximate legal body contact.

## Highest-value next work

1. **Authored animation clips and art review.** The supplied GLB has a Mixamo skeleton but no animation clips. This pass uses procedural posing; it cannot provide the nuance of an animator-approved run. Author idle, jog, sprint, hip strike and recovery clips; retarget to this skeleton; match root speed to gameplay speed; use foot IK as a correction. Review 60 fps recordings from front, side and rear, especially elbows, shoulders, fingers and sharp turns.
2. **First-time playtesting and balance.** A three-step practice drill and the charge guide are now implemented. Watch new players complete it without external instructions; tune hold windows, contact reach and movement from observed misses. Verify ring shots remain difficult but achievable in both orientations.
3. **Team playtesting.** Passes, defensive interception, blocking, shoulder charges, roles and three difficulties are now implemented. Measure completed pass chains and defensive stops, tune reaction/spacing for fair corners and free strikes, then consider 3v3 specialist abilities.
4. **Stronger arena assets.** Replace the low-resolution source atlas with properly authored stone, carved glyph and vegetation maps, including consistent texel density and normal/roughness maps. The procedural detail improves close surfaces but cannot recover missing source detail or silhouette geometry.
5. **A measured mobile quality tier.** Run the physical-device release checklist before choosing defaults. If needed, add a Low/Standard quality control for pixel ratio and shadows; use recorded frame times and thermal behavior to choose the tier.

## Release verification

- Run unit, source, build and Chromium/WebKit portrait/landscape checks on the exact release commit.
- Inspect the gameplay screenshots and record a video of movement, turning, a successful strike and a missed strike.
- Complete [the physical iPhone Safari check](IPHONE_QA.md), including ten minutes of play, audio, orientation changes and visual approval.
- Enable GitHub Pages using a repository administrator account, deploy, and check the public URL and all assets. A running private Codespace preview does not establish public availability.
