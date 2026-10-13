# PUPPET PANIC! 🎭💥

**Five puppets. Up to twenty-five friends. Nobody owns the whole body.**

A browser party game in active development: 2–25 guests join with their own phones, automatically split into balanced teams controlling one to five puppet characters on a laptop/TV. The physics host and mobile roles are separate; cooperation is mandatory for walking or carrying the cake.

## Current status — public multiplayer beta; physical device validation pending

- **Public entrance:** `/` and `/play.html` open the TV multiplayer host; development pages are not shown in its navigation.
- **Solo physics lab:** `/lab.html` remains directly accessible for engineering experiments.
- **TV/host:** `host.html` — real room roster, five-lane race rendering, per-team physics, giant join QR code.
- **Phone:** `controller.html` — one **role-only, no-scroll** control pad per person.
- **Local LAN:** `npm run dev` — Node 22+ creates rooms and relays controller inputs/telemetry using HTTP/SSE on your Wi-Fi.
- **Public internet relay:** Cloudflare Durable Object + WebSocket implementation in `worker/`, deployed at `https://puppet-panic-relay.adityasuresh2110.workers.dev`. The host connects automatically on GitHub Pages.

The GitHub Pages site serves static HTML/JS; Cloudflare operates the live room service. Live cloud protocol tests passed, but a real multi-phone party still requires physical-device testing.

## Play the solo physics lab

For development only, visit [the standalone Solo Lab](https://adityasuresh109.github.io/Puppet-Panic/lab.html). To make a valid left step hold **A + K + →** for roughly 0.35 seconds, then release A; for a right step hold **D + J + ←**, then release D. Repeat. Press **Cake Carry** for the challenge requiring both arms to grip the tray. The developer testing lab intentionally shows every button; **actual players use only their assigned phone control pad**.

## Multiplayer interfaces

- [Public multiplayer entrance](https://adityasuresh109.github.io/Puppet-Panic/)
- [Host / TV](https://adityasuresh109.github.io/Puppet-Panic/host.html)
- [Fresh /play.html route](https://adityasuresh109.github.io/Puppet-Panic/play.html) (avoids previously cached Solo Lab entry)
- [Phone controller](https://adityasuresh109.github.io/Puppet-Panic/controller.html)
- [Five-puppet TV-only preview](https://adityasuresh109.github.io/Puppet-Panic/host.html?preview=23)
- [Balance-pad preview](https://adityasuresh109.github.io/Puppet-Panic/controller.html?preview=BALANCE)

The public site connects to the Cloudflare relay automatically. The host retains a **CONNECT SERVER** override only for custom testing; guests need no configuration.

## Team formation

Use the smallest number of puppets (`ceil(playerCount/5)`) and balance the numbers among them. Examples: 2→2; 6→3+3; 9→5+4; 15→5+5+5; 16→4+4+4+4; 19→5+5+5+4; 23→5+5+5+4+4; 25→5+5+5+5+5. At most five puppets are rendered. For 2 people, one controls both legs and the other the upper body. For 5, every limb and the torso has a distinct controller. Four-player teams combine both legs onto one controller, while three-player teams divide legs, arms, and balance.

## Development and tests

Requires Node.js 22 or later. The game and local server currently have no npm runtime dependencies.

```bash
npm run dev   # LAN rooms, host and phones at http://localhost:4173
npm test      # pure physics + allocation + local HTTP + cloud Durable Object mock tests
npm run build # static GitHub Pages assets into dist/
```

## Cloudflare public relay

The backend uses Durable Objects with SQLite state, authenticated WebSockets, reconnect token rotation, role-scoped inputs, finite room lifetime and stale-control watchdogs. For setup, see [public relay deployment](docs/public-relay.md). The repository's GitHub Actions secrets are configured and the relay has been deployed. Its Worker workflow supports the existing `CLOUDFARE_*` secret name aliases. Never paste credentials into the game itself or commit them.

Public room creation, two simulated player joins, WebSocket role authorization, live input relay and telemetry passed in the cloud smoke test. Physical-phone and load tests are still pending.

## Remaining game milestones

1. Browser testing with 2–5 real phones on different networks, then 25-device load testing.
2. Live player UX: complete five-role coordination, latency/recovery telemetry and role feedback.
3. Team-size fairness study and gameplay calibration.
4. Five playable Puppet Olympics events (currently walking and cake carry are prototyped).
5. Physics animation polish, accessibility, replay highlights and full party launch.

See [the game spec](docs/technical-game-spec.md), [multiplayer UX](docs/multiplayer-ux.md), and [third-party licenses](docs/third-party-licenses.md).

## License

The project's original code has not been explicitly open-source licensed by the project owner. Its package is marked `UNLICENSED`. The QR renderer uses a separately licensed open-source implementation; see third-party notices. No paid game runtime or third-party illustration assets are required by this prototype.