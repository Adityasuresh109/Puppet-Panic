# Puppet Panic! public rooms — deployment and operations

## Status
The static game is hosted on GitHub Pages. The cloud relay implementation is included in `worker/index.js`, backed by a Cloudflare Durable Object with SQLite storage. **The Cloudflare relay is deployed** at `https://puppet-panic-relay.adityasuresh2110.workers.dev`, and automated WebSocket smoke tests have succeeded. Full 25-physical-device testing is still pending.

## What works now
- Roles and room membership are authenticated with random room tokens.
- Room setup, joining (2–25), automatic fair distribution, host-only start/mode/reset, gameplay input relay, and phone status telemetry.
- The TV runs authoritative physics; player phones only send their own assigned controls.
- WebSockets automatically reconnect; the host ignores inputs older than 1.6 seconds; lost sessions have neutralized controls.
- Durable Object state persists lobby membership, mode, and phase across hibernation. Rooms expire after four hours.
- Only the GitHub Pages origin and localhost testing origins are permitted from browsers. Room codes are 6-hex-character values, tokens are 48-char cryptographically random values.

## One-time setup (no code edits required)
1. Create/log into a **free Cloudflare account** and enable Workers and Durable Objects. Confirm current Cloudflare free-plan eligibility and limits.
2. In Cloudflare, create an API token with Workers-edit and Durable Objects/SQL permissions suitable for Wrangler deployment, and copy the Cloudflare Account ID.
3. In GitHub repository Settings → Secrets and variables → Actions → New repository secret, create `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. **Never place the API token in chat or committed code.**
4. Run the **Deploy public multiplayer relay** workflow from the Actions tab (workflow_dispatch). GitHub Actions builds/publishes `puppet-panic-relay` and reports the `https://…workers.dev` URL in its deployment log.
5. On the Puppet Panic TV page, paste just that HTTPS server URL into **CONNECT SERVER** once. The game remembers it for the host tab and embeds it in the phone invite link, so guests don't need to configure anything.
6. Perform a two-phone test, a five-phone test, then a real 25-device load test before a public release.

## Local LAN test
Run `npm run dev` and visit `http://<host-LAN-IP>:4173/host.html` on the host, then join from phones on the same Wi-Fi. The local transport uses SSE and HTTP; the public transport uses Cloudflare WebSockets. The host does not need a Cloudflare account for LAN-only testing.

## Architecture details
- Cloudflare Durable Object instance is keyed by the six-character room code.
- HTTP endpoints: `/api/create`, `/api/join`, `/api/state`, `/api/mode`, `/api/start`, `/api/reset`, `/api/input`, `/api/telemetry`.
- `/api/events?code=...` upgrades to WebSocket. The first JSON message authenticates the room and private token; tokens are **not** placed in a WebSocket query string.
- After authentication, JSON packets can be `input`, `telemetry`, and `ping`. Server pushes `room`, `input`, `telemetry`, and `ready`.
- Worker requires `Origin: https://adityasuresh109.github.io` for browser CORS or allowed localhost origins; unknown origins are rejected.
- Room storage TTL is four hours. One host and up to 25 players; reconnects allowed after the match starts if a player retains their token.
- Player status cues can be intermittent on jittery internet; the main game remains on host simulation.

## Acceptance not yet met
- Real Cloudflare deployment / browser-to-Worker connection is unverified without credentials.
- No 25-physical-device test, WebSocket packet-loss simulation against a deployed Worker, or fair-play calibration on mixed connections yet.
- The first release uses one game clock on the host; the host reconnecting mid-round restarts the simulation and will need checkpoint recovery before production.
- The host invite currently shows a shareable link and room code. The join QR code is generated locally with the included QR library.
## October 2026 audit hardening
The public backend now uses per-IP Durable Object windows to limit creation/join requests, exposes host online/offline status, supports explicit room end and host removal of lobby guests, and locks the Olympics roster between events. Host credentials are never exposed to players. **These controls do not replace Turnstile, host approval of incoming guests, or production-scale penetration tests.**
