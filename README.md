# PUPPET PANIC! 🎭💥

**Five puppets. Twenty-three controllers. Zero coordination.**

Puppet Panic! is an original, browser-based cooperative-chaos party game. Up to 23 friends control five floppy characters on one shared TV, using their own phones as body-part controllers. The fun comes from **learnable teamwork**, spectacular recoverable mistakes, expressive characters, and memorable replays.

## Project status

**Phase 0: Development foundation.** The repository is initialized; the game itself is not yet playable. Implementation starts with the *Puppet Lab* vertical slice.

## Gameplay contract

- Five simultaneous teams: 5 / 5 / 5 / 4 / 4 players at the target party size.
- Each puppet has five control channels: left leg, right leg, left arm, right arm, and torso/balance.
- Four-player teams use a dual-leg controller; physical ability limits remain identical across teams.
- Phones are controllers, **not** independent game simulations. The host/TV runs the authoritative physics.
- No permanent player elimination, no mandatory game downloads, no paid assets or runtime AI APIs.
- Mistakes should be funny, but teammates must be able to learn and improve.

## Intended stack

- **Frontend/TV**: Phaser + TypeScript + Vite
- **Physics prototype**: Phaser Matter.js; evaluate Rapier 2D if joint motors are needed
- **Phones**: responsive touch-only web UI with large controls
- **Realtime**: WebSocket relay (Cloudflare Durable Objects is the preferred free-tier candidate)
- **Visuals**: original illustrated puppets; Blender, Inkscape and CC0 assets as appropriate
- **Audio**: original and properly licensed sound effects, Howler.js and ZzFX
- **Tests**: Vitest and Playwright

All licenses and third-party assets must be tracked before shipping.

## Development milestones

1. **Puppet Lab (first playable slice):** one puppet, a short flat track, five distinct body channels, hold/release input, recoverable stumbling, checkpoint, and a finish line. Test control intuitiveness before multiplayer.
2. **Comedy pass:** expressions, squash-and-stretch, different collision reactions, comedic sound and replays.
3. **23-controller multiplayer:** five puppets, rooms, join codes, host screen, phone roles, reconnect, and server relay.
4. **Puppet Olympics:** walking, cake carrying, climbing, swinging, and finale events with balanced scoring.
5. **Polish & distribution:** tutorial, reliability and load testing, audio balancing, mobile accessibility, deployment.

## Engineering guardrails

- Prioritize fun and control responsiveness over physical realism.
- Use a fixed-time-step host simulation and send only compact input changes from phones.
- Treat the host as authoritative: clients cannot submit scores or physics state.
- Avoid relying on perfect low-latency Internet connections; tolerate jitter and reconnects.
- Never introduce mechanics that leave arm or balance controllers idle for long periods.
- Do not publish a "23-player ready" claim until a 23-device playtest succeeds.
- Keep experimental changes in branches/PRs as the codebase grows.

## First acceptance criteria

An inexperienced five-person group should be able to make the puppet move, stumble, recover, and cross a short track, with each control demonstrably affecting the outcome. Testers should noticeably improve after two or three attempts, and falls should be amusing rather than immobilizing.

## Project docs

See [the technical game specification](docs/technical-game-spec.md) for the MVP movement model, controls, multiplayer approach and test targets.

---

Original game design. External third-party components retain their own licenses.
