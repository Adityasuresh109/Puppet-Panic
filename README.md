# PUPPET PANIC! 🎭🏆

**Five puppets. Up to 25 players. Absolutely nobody controls a whole body.**

PUPPET PANIC! is a multiplayer phone-and-TV party game for 2–25 friends in a single room. Friends join a room code or QR on their phones; the host runs animated physics on the laptop/TV. Teams divide into one to five puppets, with every phone operating assigned limbs or balance controls. Cooperation is required to move at all.

## Current release: v1.0.0-rc.2 (testing, not stable v1.0)

The five-event Puppet Olympics game loop, scoreboard, role-specific phone controls, public Cloudflare relay, automatic team balancing, role rotation and host results screen are implemented. **The game is not yet certified v1.0**: the 25-device validation, human playtest and cross-platform reliability gates in [the release candidate document](docs/release-candidate.md) are still pending.

## Host recovery and player safety

Host rooms and tournament progress are saved across browser refreshes. The host can privately copy a recovery link to reclaim a party from another browser; **do not share it with guests**. Players see when the TV host disconnects, and the host can pause while a teammate reconnects. The roster is frozen after an Olympics tournament begins, so only existing players can reclaim their seats until it ends. Lobby hosts can remove unwanted participants. The public relay includes per-IP request limits; admission approval, real-device tests and advanced abuse hardening still need work.

If the Cloudflare room service is unavailable, the host screen warns you before room creation. The development/LAN alternative is `npm run dev` on a laptop on the same Wi-Fi; open the laptop's local network address on phones. GitHub Pages alone cannot run a room server and does not automatically fail over to LAN.

## Launch multiplayer

- [Open the official TV host](https://adityasuresh109.github.io/Puppet-Panic/)
- [Alternate host link](https://adityasuresh109.github.io/Puppet-Panic/play.html)
- [Controller join page](https://adityasuresh109.github.io/Puppet-Panic/controller.html)

Create a party room on your laptop, put the host page on the TV, invite players via QR, and choose **Full Puppet Olympics** (all five stages) or **Quick Challenge** (one stage). Each phone receives its own no-scroll controls. Teams form automatically: 2→2; 8→4+4; 9→5+4; 15→5+5+5; 16→4+4+4+4; 19→5+5+5+4; 23→5+5+5+4+4; 25→5+5+5+5+5.

### Challenges

1. Walk, You Idiots! — coordinate alternating feet, opposite arm and torso.
2. Don't Drop the Cake! — maintain both grips, stabilize the tray, save its three layers.
3. The Impossible Climb — secure handholds and carefully transfer weight along the obstacle tower.
4. Swing for Your Life — keep both hands gripping and pump through rope crossings.
5. Puppet Olympics Finale — sprint, cake and climb sections, with a 1.5× point multiplier.

All five events are available in the current build. Stage-specific gameplay, physics difficulty, and the fairness of 2-, 3-, 4-, and 5-person teams require further human testing; currently the rig uses assisted custom physics rather than a full rigid-body solver.

## Rules

- Room size 2–25, host is separate and doesn't count as a player.
- Number of puppets = `ceil(players / 5)`, balanced sizes within one player.
- Event ends when all puppets finish or the time limit expires.
- Finishing teams place ahead of unfinished teams; standings award 100/80/65/50/40 plus up to 20 objective-quality points. The finale awards 1.5×; cumulative points decide the champion.
- Roles rotate between rounds. No team is permanently eliminated.

## Development

Requires Node 22+ and no mandatory paid runtime services.

```bash
npm run dev     # local LAN server at http://localhost:4173
npm test        # physics, relay, teams, security, stage and release-contract tests
npm run build   # production static build to dist/
```

GitHub Pages hosts static files; Cloudflare Durable Objects hosts the public WebSocket relay. The host is authoritative for physics and scoring. Mobile browsers submit only role-scoped inputs. The development-only Solo Lab lives at `/lab.html`, with no public navigation shortcut.

## Limitations

Read [release verification requirements](docs/release-candidate.md), [technical spec](docs/technical-game-spec.md) and [cloud relay setup](docs/public-relay.md). We won't call this a verified v1.0 until it is reliably playable by people on 25 real devices, including phone/browser and connection recovery tests.

The original code has no granted open-source license (`UNLICENSED`). Third-party dependencies preserve their own license notices; see project documentation.