# Puppet Grand Prix — v2 alpha development branch

**Status:** experimental, maintained only on `v2-race`. v1 `main` and its GitHub Pages deployment remain unchanged.

## The two game versions cannot share a room

Grand Prix rooms opt in with `{ "variant": "grandprix" }` when created, use 1–24 players and exactly four limb channels, and have a `warmup` phase. V1 rooms still use `variant:"olympics"` and their existing team allocation, balance roles, 2–25 player threshold, server authorization and progression. The v2 deployment uses a DIFFERENT Cloudflare Worker and SQLite Durable Object namespace, not the v1 production Worker.

**Preview:** `https://puppet-panic-grand-prix.adityasuresh2110.workers.dev/` after v2's dedicated workflow succeeds. Do not deploy the v2 code to the original v1 Worker or merge it into `main` without a real human playtest.

## Mechanics

- One person plays the whole puppet (four buttons); two players get diagonal limb pairs; three get one diagonal pair plus two single-limb controllers; four get one limb each. The allocator evenly distributes 1–24 people among up to six puppets.
- A left/right alternating step plants on release; 0.15–1.05 seconds is the generous hold window; a step no more often than every 0.35s. Repeat-foot and excessive mashing make a stumble. A stationary puppet is safe. Double-leg holds over a second trigger a recoverable one-second fall without a positional reset.
- Beat pulse rewards step timing, but never makes an off-beat step fail. Opposite arm held in walk mode adds a speed bonus, not a movement prerequisite.
- Cake requires both arms held; released arms spill cake layers. Swing requires both grips and alternate leg pumps; dropped grip causes a stumble/fall. Climb requires three held limbs while just one reaches (release -> re-grip); a double reach never gives progress. Finale transitions walk -> cake -> climb based on actual distance.
- On the TV, up to six lanes show live puppet progress. The race is ranked by finish time; unfinished entries by progress and falls.
- Every phone displays the owned limb diagram, 1–4 touch buttons and an event-specific job. Stage changes trigger a 3-second job overlay. The lobby has an interactive warm-up before the first scored event.

## Confidence levels

- Node tests validate team assignments, locomotion, event-specific interactions, solo feasibility, simulated first-timer completion, six-puppet race and warm-up authorization.
- Chromium integration validates room creation, phone pairing, six TV lanes, warm-up presses and changing phase.
- **NOT YET VERIFIED**: real first-timer party play, real 24-phone network load, iOS/Android device ergonomics, and perceived fun. Do not mark stable v2 or replace v1 until those gates pass.