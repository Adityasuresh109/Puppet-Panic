# PUPPET PANIC! — Puppet Lab 🦵💥

**Five puppets. Twenty-three controllers. Zero coordination.**

Puppet Panic! is an original TV + phones cooperative-physics party game in development. Our first **playable browser prototype** is **Walk, You Idiots!**: control Bongo's limbs separately, stumble your way through hazards, and reach the finish.

![Browser game screenshot](docs/lab-screenshot.jpg)

## Try the current prototype

- Open **index.html** on a web server, or use the project URL after Pages deployment is configured.
- Click **LET'S MAKE A DISASTER**.
- Alternate holding/releasing **A** (left leg) and **D** (right leg). Planting each foot propels Bongo forward.
- Press **J** and **K** to swing individual arms for a little extra momentum and stability.
- Hold **Left / Right arrows** to lean the torso; tap **Space** to brace (cooldown).
- Press **R** to restart and **H** for instructions, or use the on-screen touch controls.
- **WATCH AI DEMO** enables a scripted automated control pattern for demonstrating the physics; it is not a paid AI API.

At the moment, the five control channels are all available from one browser. **There is no multiplayer room or phone-to-TV synchronization yet.**

## Run it locally

Requires Node.js 20+; there are **zero npm dependencies** in this experimental prototype.

```bash
npm run dev
# open http://localhost:4173
```

Run tests and produce static output:

```bash
npm test
npm run build
# deploy dist/ as static site
```

The game is also suitable for simple static hosting (for example GitHub Pages) because it uses native browser APIs and ES modules. For best results, use a modern Chromium, Safari, or Firefox browser.

## What is already implemented

- [x] One animated, articulated assisted-puppet with simulated momentum and balance
- [x] Independent left/right leg stepping, left/right arm swinging, torso lean and brace
- [x] Recoverable falls, timed automatic get-up, fall counter and wobbly state
- [x] Camera-following cartoon running course, three checkpoints, three cones and finish
- [x] Comic facial expressions, sound synthesis, toast reactions and confetti
- [x] Working keyboard and on-screen pointer/touch controls
- [x] Auto-demo mode, restart, instructions and sound toggle
- [x] Deterministic simulation tests plus manually checked browser interactions

## Next development gates

1. **Human playtest** (Issue #1 still open): confirm the body-part controls are genuinely fun with real players. Tune cadence, penalties and fall recovery.
2. **Advanced joints / visual polish**: currently the puppet uses custom assisted torso physics and spring-damped limb particles. Evaluate replacing this with motorized Rapier 2D joints or Phaser/Matter.js integration when installation is available. Do not confuse this physics lab with a full physically constrained ragdoll.
3. **True multiplayer**: room code, authoritative TV/host simulation, WebSocket relay, phone-specific roles, reconnect, four-player team controls, five puppets, load testing with 23 devices.
4. **Events**: Don't Drop the Cake, The Impossible Climb, Swing for Your Life, and the Puppet Olympics finale.
5. **Presentation**: audio polish, animation and high-quality replay export, deployment and social sharing.

See [the full technical spec](docs/technical-game-spec.md) and [build progress](docs/progress.md).

## License and assets

Original game artwork, rendering code and synthesized sound have no third-party media dependencies in this slice. The original game code has **not** been explicitly open-source licensed by the project owner; `package.json` uses `UNLICENSED` pending that decision. Future dependencies and asset packs will be inventoried in this section and tracked by license before shipping.

### Status / limitations

- Local scripted browser interaction has been validated; a real multi-person playtest and cross-device mobile QA are pending.
- No live multi-device service or final production URL has been deployed by this commit.
- This browser-only physics proof-of-concept is a deliberate zero-dependency stepping stone toward the planned Phaser/modern physics engine.