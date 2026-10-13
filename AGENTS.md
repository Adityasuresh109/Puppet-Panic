# Instructions for coding agents — Puppet Panic!

## Product goal
Build a polished, **actually playable** 23-person TV+phone party game. Do not substitute concept art, mock screens, or canned animation for player-controlled ragdoll physics.

## Read first
1. `README.md`
2. `docs/technical-game-spec.md`
3. Current GitHub milestone/issue before coding

## Implementation order
Start with GitHub issue #1, the **Puppet Lab** vertical slice. Favor demonstrable working physics and distinct arm/leg/balance controls over polished menus. Iterate in small slices with builds/tests and working previews.

## Technical principles
- Phaser + TypeScript + Vite is the preferred frontend. Matter.js is the initial physics candidate. Compare with Rapier 2D when stable powered joints warrant it; document decisions.
- Body parts must be mechanically interactive, not visually decorative.
- Keep physics/game state independent from UI render code and multiplayer transport.
- Host is authoritative for physics; mobiles eventually send only inputs.
- Prefer clear, maintainable modular code over giant single-file applications.
- All players stay engaged. A 4-player dual-leg controller must be fair against a 5-player setup.
- No paid API requirements, runtime AI calls, or assets with unclear rights.
- Do not expose credentials or keys. Track asset/dependency licenses.

## Verification policy
- Run install/build/test steps in the environment before declaring milestones finished.
- Show evidence of live interaction from a running build; if execution cannot be verified, say so clearly.
- Distinguish local prototype, deployed preview, and 23-player-tested production readiness.
- Document exact commands, limitations, and remaining follow-ups in the PR.

## Git workflow
- Keep `main` working; implement features on branches and open PRs when appropriate.
- Keep commits focused and explain notable physics changes and design tradeoffs.
- No destructive force pushes without explicit need.
