# Puppet Panic! — v1.0 release candidate

## Release scope
- Host-controlled five-event Puppet Olympics, optionally a single quick challenge.
- 2–25 guests, 1–5 team puppets; team count is ceil(n/5), balanced team sizes.
- Independent dedicated phone-role controllers with zero-scrolling UI, QR joining, Cloudflare WebSocket relay.
- Events: Walk You Idiots; Don't Drop the Cake; Impossible Climb; Swing for Your Life; Puppet Olympics Finale.
- Coordination-first stepping: correct alternate foot, 0.22–0.78s timing, opposite arm support, torso shift; holding a single control never causes travel. Swing requires both grips and rhythmic leg/torso pump. Climb penalizes loss of handholds. Cake loses layers when tray tilts or grips release. Finale changes mechanics at 1/3 and 2/3 progress.
- Timing and results: event-specific 120–180-second caps; placements score 100/80/65/50/40 with objective quality bonus up to 20; finale 1.5×. Cumulative podium after five events.
- Automatic scorecards, next-event flow, light cartoon announcer/sound effects, muted-audio option, and in-tab host-state checkpoint recovery.
- Local Node LAN relay and Cloudflare Durable Object public relay.

## How to play
1. Open `https://adityasuresh109.github.io/Puppet-Panic/` on a laptop connected to the TV.
2. Create a party room. Players scan QR from phones and join with their names.
3. Select Full Puppet Olympics or Quick Challenge. Teams allocate automatically based on lobby size.
4. Host starts. Everyone operates only their assigned body controls on a single, full-height phone screen. Communicate with your team while watching the TV.
5. After each event, scores display. In Olympics mode the host selects Next Event and roles rotate. After event five, show champion standings and return to lobby.

## Important limitations / acceptance gates before stable v1.0
This is **1.0.0-rc.1**, not a certified stable release.
- Needs a full real-device 25-phone session: iOS and Android browsers, Wi-Fi and cellular, backgrounding, reconnecting, input latency and consistency. Automated 25-socket simulation is not equivalent to this test.
- Needs observed human playtesting of climb, swing, and finale mechanics and 2/3/4/5-player control fairness. The physics remains an assisted custom spring model, not a motorized rigid-body solver.
- Needs browser end-to-end regression against the *deployed* five-event UI; environment-level sandbox browser navigation may be blocked.
- Needs accessibility and audio checks on actual phones and typical smart-TV browsers.
- Stage-specific props and replay video export are not yet implemented. Existing sound reactions are generated, not prerecorded announcer lines.
- Host session progress is locally checkpointed, but prolonged host disconnection requires manual review before production.

No game is declared stable simply by increasing its package version or passing unit tests. The v1.0 tag follows the above gates.