# iPhone Safari release check

Record the tested commit, public URL, iPhone model, iOS version, tester, and date with the results below. Keep the pull request in draft until the automated validation and this manual check pass.

## Automated gate

1. The `Validate game` workflow must pass on the pull request head, including Chromium and WebKit browser checks. Inspect the uploaded `game-preview-checks` screenshots in portrait and landscape.
2. The `Deploy playable demo` workflow must pass on the intended release commit. Open the public Pages URL and confirm the arena and character assets load without a 404 or runtime error.

## Device check

Test on a recent iPhone and the oldest iPhone intended to be supported, using Safari rather than a desktop WebKit emulation. Test portrait and landscape on both devices.

- From a fresh load, enter Solo Challenge, move with the joystick, drag the court to aim, strike the ball, pause and resume, and return to mode selection. Confirm the controls stay clear of the safe areas and Safari browser chrome.
- Complete Practice. Test Hip, Elbow and Knee charge windows; release, cancel by pausing, and switch strikes. Check pass, deflect and bump controls with simultaneous movement. Confirm gold charge timing remains readable in both orientations.
- Enter 2v2. Confirm one human fighter, one Sun teammate, and two rivals are visible and distinguishable. Play until both teams have scored, then finish a match and use Play Again. Confirm scores and fighter positions reset.
- Verify 1-point back zones, 3-point wall combos, 10-point rings, second-bounce penalties, protected free strikes and a tied-timer sudden-death ring win. Observe actual teammate receptions and defensive stops at each difficulty.
- Repeat matches for at least ten minutes. Record startup time, sustained and worst visible frame rate, memory or WebGL context loss, audio behavior, and whether controls remain responsive as the device warms. Agree on the minimum supported frame rate before release; 30 fps sustained is a proposed floor.
- Capture portrait and landscape screenshots plus a short gameplay video. Review arena scale, warrior animation, stone detail, team markers, HUD legibility, scoring feedback, and overall visual quality. Record explicit visual approval or the changes required.
- Record walking/running from front, side and rear, including abrupt turns and stopping. Check that stance feet touch the ground, knees bend forward, wrists/fingers move naturally, and both team colors remain readable in shadow. Check strike anticipation, contact, recovery and a missed strike; ball motion should start at contact, not at the start of the windup.

If performance misses the agreed floor, measure with Safari Web Inspector before changing quality settings. Start with device pixel ratio, shadow resolution, and the four animated character rigs, then rerun the same device check after each change.
