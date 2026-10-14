# Puppet Panic! — v1.0.0-rc.2 audit-hardening candidate

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
## Audit corrections in rc.2
- Host credentials persist on the host browser, and a private recovery URL may be saved for reclaiming the party from another device. Players are told when the host loses connection.
- Save/restore complete tournament state, results screens, event position and pause state through refreshes.
- Host cannot repeatedly create a room; double Join is guarded. Explicit End Party invalidates the room.
- Olympics rosters are locked at first Start and unchanged until the tournament ends; host can remove unauthorized players while lobby is unlocked.
- Relay preflight shows online/offline status and documents LAN fallback. Production Pages links cannot silently redirect to an arbitrary attacker relay.
- The TV uses the same per-event hazard locations as physics. A short last-moment input cannot replace sustained coordination, and no-hands climb drag is tuned. Finale stage follows current position, not farthest historical progress.
- Placement point bonuses no longer invert rank order; two-person teams may brace.
- Automated regression tests now cover recovery, roster locking, safe end, and control fairness. Chromium UI integration runs on pull requests.

## Remaining stable v1.0 gates
1. Test a real five-event session through the complete winners screen with real friends, including a laptop restart and several phone disconnects.
2. Test 25 physical phones in the intended Wi-Fi environment and compare mixed-size 4-versus-5 player team fairness.
3. Add host approval for unsolicited joins, full abuse protection, and a practical supported LAN failover or second relay before an unrestricted public launch.
4. Validate accessibility across iOS/Android and polish gameplay/sound based on human feedback. Until then **do not tag stable v1.0**.
