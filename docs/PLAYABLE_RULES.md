# Playable rules and controls

## Match

2v2: human Sun striker and a Sun AI versus two Rival AIs. First to 20 points, or the lead after three minutes. A tied timer starts sudden death; only the next ring ends the match.

- Sun attacks the crimson back zone at positive Z; Rival attacks the teal zone at negative Z. Crossing the opponent's zone gives 1, including own goals.
- Threading the ring gives 10 to the last legal striking team.
- Hit two **distinct** wall surfaces, then the rim, without another legal contact: 3.
- One floor bounce per legal contact. A second gives the opposing team 1. Untouched serves do not trigger this penalty.
- Feet or head height during passive body contact causes a turnover and three-second protected free strike. Body-height contact can deflect and change possession. This uses simplified height bands, not exact per-bone limb collision.
- Equal opposing contacts in the same simulation step clash. Otherwise distance, facing and timing decide the contest.

## Strike mastery

Hold Space, the court mouse button, or STRIKE; release when the charge reaches the gold window. Power depends on charge, timing, angle, movement and stored kinetic. Overcharging reduces accuracy and quality. The guide shows the nominal trajectory; errors, moving balls and opponent contacts can change it.

| Strike | Select | Ideal hold | Choice |
| --- | --- | --- | --- |
| Hip Smash | 1 / Hip | 0.75 s | Strong forward strike |
| Elbow Ricochet | 2 / Elbow | 0.35 s | Low, precise redirect |
| Knee Volley | 3 / Knee | 0.60 s | Lofted shot |

WASD/arrows or joystick move. Mouse or tap the court aims. Q/Pass targets an advanced teammate; E/Deflect redirects nearby balls; Shift/Bump bursts forward with collision and a cooldown. Get behind the ball and face your target. Swing contact is checked again after anticipation, so a ball that moves away is missed.

On iPhone, keep your left thumb on MOVE. Hold the right strike pad and drag in the shot direction; lift that thumb to strike. A gold arc marks the release window and the ring fills as you charge. Both thumbs work simultaneously. Hip/Elbow/Knee and Pass/Block/Dash sit near the thumb pads; short portrait screens split the extra buttons between the two sides. Scores and kinetic are above the court; controls respect safe areas in both orientations, including short Safari landscape viewports. Landscape provides a wider view. The camera fits all active fighters inside the area clear of the controls. Passive ball contact requires overlap with a finite body capsule, so an overhead ball does not foul a player on the ground.

Easy/Normal/Hard vary AI reaction delay, speed, aim error and aggression. Aim assist is a small angle bias (45%/14%/0% within 20 degrees); it never solves a guaranteed ring trajectory.

Completed teammate contacts build pass chains and kinetic. Heavy strikes use up to 20 kinetic scaled by timing; new contacts also replenish it. Defensive blocks do not spend it.

## Replay

Practice teaches approach, charge timing and a first attacking point. Solo lasts 60 seconds, increases ring motion and shrinks it as points rise, adds two collidable obstacles at 30, and multiplies repeated rings up to 4×. A fault breaks the ring chain.

Local storage keeps solo best, match count and wins. Three wins unlock Amber clothing. Storage failures do not prevent play. Match serves and AI decisions use seeded random generators; frame cadence and live input still affect a match, so this is not a deterministic replay/network simulation.

## Remaining work

Playtest strike balance and AI passing on physical iPhone Safari. Procedural poses distinguish elbow/knee/hip, but the supplied skeleton has no authored clips; a polished sports animation set and animator review remain necessary. Exact limb contact, 3v3 specialist abilities, rounds, career progression and networking are future work.
