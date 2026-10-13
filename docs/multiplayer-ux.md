# PUPPET PANIC! — Responsive team allocation + three-screen multiplayer specification

## Locked requirements (approved October 13, 2026)
- Exactly **2–25** players (host not counted). Each puppet has at least two operators and at most five.
- Maximum **five** simultaneous puppets, but fewer puppets appear when fewer people join.
- Automatically create the **fewest possible teams**, distributing teammates as evenly as possible. Teams are finalized when the host presses Start. Before start, an additional join can rebalance everyone's role; every phone receives the new assignment.
- One team for 2–5 players is a **cooperative time trial** rather than a fabricated race against other human teams. At 6+ players, compete between teams.
- Lobby allows guests to join without account registration, using room code and a display name.
- Host display owns **all physics, characters, obstacles, timing and scoring**. Phone controls own only their assigned station. Neither host game scene nor scrollable debug control deck appears on the phone.
- Player-facing controller must fit on a single phone viewport, including iPhone browser chrome/safe areas, without scrolling. Touch controls remain usable with one or two thumbs.

## Deterministic allocation
`teamCount = ceil(playerCount / 5)`; `baseSize = floor(playerCount / teamCount)`; first `playerCount % teamCount` teams have `baseSize+1`, all others have `baseSize`.

| Players | Team sizes | Puppets | Players | Team sizes | Puppets |
| --- | --- | --- | --- | --- | --- |
| 2 | 2 | 1 | 14 | 5+5+4 | 3 |
| 3 | 3 | 1 | 15 | 5+5+5 | 3 |
| 4 | 4 | 1 | 16 | 4+4+4+4 | 4 |
| 5 | 5 | 1 | 17 | 5+4+4+4 | 4 |
| 6 | 3+3 | 2 | 18 | 5+5+4+4 | 4 |
| 7 | 4+3 | 2 | 19 | 5+5+5+4 | 4 |
| 8 | 4+4 | 2 | 20 | 5+5+5+5 | 4 |
| 9 | 5+4 | 2 | 21 | 5+4+4+4+4 | 5 |
| 10 | 5+5 | 2 | 22 | 5+5+4+4+4 | 5 |
| 11 | 4+4+3 | 3 | 23 | 5+5+5+4+4 | 5 |
| 12 | 4+4+4 | 3 | 24 | 5+5+5+5+4 | 5 |
| 13 | 5+4+4 | 3 | 25 | 5+5+5+5+5 | 5 |

**Exceptions:** A 4–5-only partition is impossible for 6, 7 and 11 players; we allow 3-person teams there. Two-person teams only exist when total participants equal two.

## Role allocation / controllers
- **2 players:** player A controls both legs, player B controls upper-body direction (which includes opposing arm counter-swing) and cake grip. Reduced independent degrees of freedom but no autoplay locomotion; the two still must coordinate every step. Upper body has only 3 controls (lean left / lean right / grip) and cake grips both arms; brace omitted.
- **3 players:** dual legs; dual arms; balance.
- **4 players:** dual legs; left arm; right arm; balance.
- **5 players:** left leg; right leg; left arm; right arm; balance.

**All modes:** single team balance physics; roles shared/combined rather than creating phantom teammates. Relative difficulty for 3v4v5 teams needs human playtesting and potentially explicit handicap balancing. Do not silently grant extra speed to short teams.

## User screens
### TV host — `/host.html`
- Host creates private room, displays 6-character join code and join link, sees player count and dynamic allocation preview.
- After Start, show **exactly one puppet per team** (1–5), full-screen lanes, team names, progress, time, faceplants, obstacle course, cake layers (when applicable), standings and recovery comedy.
- Host alone may choose event, start/reset game. No phone-sized individual control panels on host display.

### Phone — `/controller.html`
- Before joining: short code and name form.
- In lobby: shows assigned team/role. May change before start due rebalancing.
- During challenge: sticky top team label, big role name, concise cue, **1–3 large buttons filling remaining viewport**, connection indicator. **No body/world canvas, footer menu, scrolling or separate control sections**.
- Inputs sent as changes, sequenced and scoped to role; stale inputs cleared when disconnected. Audio/haptics optional.
- Phone must show reconnecting/offline status if transport drops.

### Solo debugging — `/index.html`
- Preserve existing all-controls-on-one-page lab as a debug mode only, never expose it as the default mobile controller.

## Current implementation state
- Allocation, role maps and 2–25 validation: implemented in `src/teams.js` with Node tests.
- Local LAN HTTP server + event-stream relay: implemented in `dev-server.js` and `src/server/rooms.js`. The host runs physics; room service handles identity/roles and sanitized input transport.
- TV host: `host.html`, `src/host.js`, `room.css`.
- Fullscreen mobile controller: `controller.html`, `src/controller.js`, `room.css`.
- Browser UI preview: `/controller.html?preview=BALANCE` (similarly `LEFT_LEG`, `RIGHT_LEG`, `DUAL_LEGS`, `LEFT_ARM`, `RIGHT_ARM`, `DUAL_ARMS`, `UPPER_BODY`). **Preview is intentionally not connected to a room.**
- Github Pages can host the static UI only. The LAN room server is NOT available on GitHub Pages. A production public HTTPS/WSS relay such as Cloudflare Durable Objects must be deployed and the client transport adjusted for that endpoint before guests on arbitrary internet connections can join.

## Running a real LAN test
On a laptop running Node.js 22+, run `npm run dev`. Find the laptop's LAN IP (example `192.168.1.50`). On its browser go to `http://<LAN-IP>:4173/host.html`. Create room. Share `http://<LAN-IP>:4173/controller.html?room=<CODE>` on phones connected to **the same Wi-Fi**. Firewall/router may need to allow port 4173. Avoid insecure public port forwarding; room service is development-only.

## Security and QA gaps before a public 25-player launch
- Replace development HTTP/SSE bridge with authenticated public HTTPS WebSocket/Durable Objects transport. Add rate limits, explicit room expiry, stable reconnect ownership, input TTL and timeout behavior, and reconnection tests.
- Add host authority and timing integrity tests; the host browser currently remains the scoring authority and a host reload resets local simulation.
- 25 real phones and 5 puppets must pass end-to-end latency and visual readability testing across iOS/Android/browser chrome/safe-area sizes.
- Adjust challenge mechanics and scoring for mixed team sizes based on playtesting. Five events and cinematic replays are not yet implemented in multiplayer.