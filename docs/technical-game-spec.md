# PUPPET PANIC! — Technical Game Specification (Draft 0.1)

## Product intent
A TV-first party game for **23 simultaneous players**, split into five teams of 5/5/5/4/4. Each team's floppy puppet is operated by separate players' phones. The central experience is coordinated movement, funny but recoverable physics mistakes, and immediate visual feedback. The game must be teachable in under two minutes.

This is an engineering starting point, **not a claim of completed functionality**. Numeric parameters below are initial tuning targets to validate through playtests.

## Development priorities
1. Fun and understandable limb control (not physically perfect simulation).
2. Comedic, recoverable failures; avoid long ragdoll lockups.
3. Low-latency mobile input and reliable reconnect.
4. Five team puppets on a legible TV at ordinary living-room viewing distances.
5. Progression through five event types once foundational movement is validated.

## Runtime architecture
- **TV/host client**: Phaser 3, TypeScript, Vite; renders and simulates one world containing up to five puppets.
- **Physics**: evaluate Phaser's Matter.js integration first. Use a motorized-joint alternative such as Rapier 2D if stable powered limbs are too expensive or fragile to emulate in Matter.js.
- **Phone client**: mobile portrait web controller; pointer/touch-first, no on-device world simulation.
- **Relay**: WebSockets, room codes, authoritative host/session ownership, a reconnect token per player. Candidate free-tier deployment: Cloudflare Durable Object.
- **Authority**: room service decides membership/team/role; host is sole physics and score authority; clients send discrete input state and never declare results.
- **Deployment**: static frontend via GitHub Pages or Cloudflare Pages; separate relay endpoint, configured via environment/manifest. Never place privileged secrets in client code.

## Physics and control design
### Character construction
Prototype an 11-body silhouette: head, torso, pelvis, and an upper/lower segment for each of two arms and two legs. Use joint constraints, damped angular motion, modest collision filtering for adjoining segments, and oversized expressive head/feet cosmetics. Simplify the body rig as necessary to preserve stability at the target framerate.

The puppet should be *assisted*, not fully passive. A neutral controller can help prevent tiny bumps from causing a full collapse, while deliberately mistimed inputs still cause stumbles.

### Initial timestep and camera targets
- Deterministic/fixed simulation interval: **1/60 s**, with delta accumulator and catch-up cap. Avoid raw per-render-frame force logic.
- Desired host display: 60 fps on mainstream laptop hardware; graceful fallback without changing gameplay speed.
- TV uses five visible horizontal lanes for races; each lane may follow its own puppet. Clearly display each team's progress even if lanes use individual cameras.
- Cap particle/audio/visual effects; accessibility toggle for screen shake and flashing effects.

### Input roles
**Leg L / Leg R**
- HOLD STEP: raise corresponding foot and drive it toward a forward target.
- RELEASE: plant foot and allow contact/friction.
- Assisted gait: alternating planted feet generate forward momentum. Simultaneously lifted feet reduce support and increase stumble risk, *not an instant guaranteed wipeout*.
- Use edge-triggered hold changes, not repeated button-spam rewards.

**Arm L / Arm R**
- Directional pad/large swipe region: steer reach direction.
- GRAB toggle/hold when hand overlaps a valid interactable.
- During running, arm swings can counterbalance; during climbing, gripping supports weight; during carrying, arms stabilize a shared object.
- Every challenge must create meaningful arm involvement.

**Torso**
- Left/right lean input, neutral center when released.
- BRACE: temporary extra stability with visible cooldown.
- Do not let permanent holding of a button become the optimal strategy.

**Four-player teams**
- One player operates dual leg controls; two operate one arm each; one operates torso. Input and physics constraints remain identical. Test that different finger ergonomics don't introduce systematic disadvantage. Prefer role assignment/rotation that spreads workload.

### Recovery
- Brief recoverable stumble on mild loss of balance.
- Full collapse produces a comic reaction and a recoverable get-up action; target approximately 2 seconds of automatic recovery unless coordinated players recover sooner.
- Off-course fall -> checkpoint respawn with short, uniform delay.
- Never allow a character to remain permanently trapped in collision geometry; safe timeout fallback.

### Prototype keyboard bindings
While phone networking is absent, map Q/A to left-arm/leg, P/L to right-arm/leg, arrows to torso lean, Space to brace; indicate pressed controls onscreen. Bindings are prototype-only, not player-facing final UX.

## Events (full product roadmap, not MVP scope)
1. **Walk, You Idiots!** — 24 m track, checkpoints; time/progress scoring.
2. **Don't Drop the Cake!** — 18 m walk while stabilizing a tray; cake layers intact and finish time.
3. **The Impossible Climb** — handholds, footholds and fall-recovery platforms.
4. **Swing for Your Life** — controlled rope grip, body momentum, releases and safe landings.
5. **Puppet Olympics** — three-minute gauntlet combining prior skills, 1.5x point weighting.

Initial event durations and distances are playtest tunables, not hard-coded global constants.

## Session and scoring
- One host starts, pauses between, advances, and ends events.
- Lobby assigns teams, exposes participant count and missing controllers, allows controlled rejoins.
- All teams race simultaneously, no eliminations.
- Standard placement: 100/80/65/50/40; up to 20 event-specific objective points. Finale 1.5x.
- Primary race ranking: finish time for completed teams; unfinished by checkpoint count then distance. Tie-breaker: finale result, then number of event wins.
- No unbounded score from button mashing or repetitive recoveries.

## Networking contracts (v0, to refine when implementing)
### Client -> relay / host
`join_room { roomCode, playerName, reconnectToken? }`
`input_change { seq, role, controls, clientTime }`
`heartbeat { clientTime }`

### Host -> relay / clients
`room_state { phase, teams, assignments, version }`
`control_assignment { role, teamId, version }`
`game_event { kind, payload, eventId }`
`host_status { phase, elapsedMs, version }`

- Authenticate event ownership using room-issued tokens, never trust a role string received from a phone.
- Relay checks rate and payload size, rejects stale role assignment versions, and forwards sanitized input.
- Recommend sending only changed input states (target <=20 updates/sec per controller under active use); timeout stale held controls to neutral to avoid a disconnected leg being stuck forever.
- Handle out-of-order packets with per-player increasing sequence numbers. The host determines actual applied tick.
- Reconnect by stable player token; when disconnected, apply conservative assist rather than boosting team performance.
- Never rely on full continuous world-state broadcasts to all phones. The TV is the shared display.

## Humor / presentation system
Use event-driven reactions keyed to actual physics:
- Sudden angular velocity -> widened eyes, whoosh.
- High-impact landing -> thud, brief squash/stretch, recovery pose.
- Near-fall recovered -> relieved expression, celebratory squeak.
- Finish while stumbling -> exaggerated victory pose.
- Sustained collapse -> context-aware announcer line with cooldown.

Audio, particles and face changes should *not* alter collision hitboxes or physical fairness. Limit repetitive audio, support sound-off, and use only properly licensed assets.

### Replay of Shame
Record a circular buffer of position/rotation and semantic events for recent host simulation steps. Between races, replay selected biggest tumble, near-save, and comeback. MVP can omit replay export.

## Milestone 1 — Puppet Lab: definition of done
- A local dev server starts cleanly from README commands.
- One puppet appears and accepts distinct leg, arm, and balance inputs.
- All five control channels create visible mechanical effects.
- The puppet walks, loses balance after mistakes, and recovers without restart.
- At least one checkpoint, goal line, start/restart controls, and progress feedback.
- README describes controls and known limitations.
- Build passes; tests cover pure state/scoring/utilities where practical.
- Basic playtest establishes that repeated attempts improve completion and humor is not solely random.

## Milestone 2 — 23-player validation gate
- Five puppets simultaneously controllable over room WebSockets.
- 23 phones + host connected; realistic held input, reconnect and reconnect takeover.
- Measure command-to-visible-response latency, jitter, CPU load, memory, network usage, and device/browser compatibility.
- Verify 5/5/5/4/4 ergonomics and fairness before representing it as party-ready.
- No arbitrary “ready for 23 users” announcement based solely on account quotas.

## Working agreement
Keep code modular (physics vs. presentation vs. networking vs. scoring), use feature branches as appropriate, run builds/tests, document dependencies/licenses, and do not substitute static illustration for actual playable mechanics.
