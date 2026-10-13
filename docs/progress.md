# Development progress — 2026-10-13

## What this change implements

A real playable single-puppet 2D prototype: articulated sprite drawing from spring-based limb particles, a simulated torso with rotational forces, separate leg planting impulses, independent arm contributions, balance / brace and cooldown, track hazards, checkpoints, recovery, finish and scoring telemetry.

### Test evidence
- Node `npm test`: **7 passing** deterministic simulation tests.
- Node `npm run build`: passed static build.
- Headless Chromium tested with an equivalent inlined page bundle (direct local navigation was restricted by the test environment). Clicking Start and alternating 14 A/D holds moved the puppet from x=115 to approximately x=488; activating AI demo continued movement beyond x=690, with no reported page errors.
- See `docs/lab-screenshot.jpg` for an actual captured browser frame.

## Engineering note: zero-dependency first slice

The existing technical spec proposes Phaser + Matter.js or Rapier. The first slice uses **custom deterministic assisted physics** plus native browser Canvas because the local build environment could not download npm packages for Phaser/Matter.js. This allows an actual executable prototype to be developed and verified without external assets or network access. The rig is currently hybrid/spring-based, not a complete rigid-body ragdoll. We should compare stable motorized joints from Rapier before adding the climbing and swinging challenges.

## Unfinished / do not claim complete

- **GitHub Issue #1**: needs external playtesting and joint-physics evaluation.
- No phone-specific join/role or 23-device networking, and no cloud relay deployment yet.
- No second through fifth events, replays, tournament, team fairness validation, or user-generated highlight videos.
- Headless browser execution did not exercise served ES module loading due to network/navigation policy restrictions; modules have correct local paths and build outputs, but Pages deployment remains unverified.

## Next implementer priorities

1. Validate this build from an ordinary hosted URL and obtain basic playtest feedback.
2. Implement a secure room/session relay with WebSockets, unique join tokens, 23 controllers plus host, and 5/5/5/4/4 assignment support.
3. Add dedicated phone controller pages with individual limb roles; the host remains authoritative.
4. After physics testing, build a second challenge demonstrating meaningful arm and torso interaction (Don't Drop the Cake).