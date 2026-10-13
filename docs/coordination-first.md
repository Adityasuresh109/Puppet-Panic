# PUPPET PANIC! — Coordination-first mechanics (Version 0.2)

## Why we changed the game
A real playtest exposed a fundamental failure of v0.1: repeatedly pressing a single input generated forward movement, preventing falls and making limb coordination unnecessary. That defeats the reason for using five people per puppet. Version 0.2 removes unconditional acceleration from leg-release and arm events. Every meaningful advance has multiple independent causes, and missed coordination produces understandable consequences.

## Required movement teamplay
- **Leg 1 / Leg 2:** The next moving foot is determined by the last *successful* step. The supporting foot stays planted. Each player must hold the lift for approximately 0.22–0.78 seconds, then plant.
- **Opposite arm:** During a left-foot step the right-arm player counter-swings; during a right-foot step the left-arm player counter-swings. Both arms are meaningful over an alternating pair of steps. Opposite arm motion is assessed across the duration of the lift, not just on one frame.
- **Torso:** The torso player must shift body weight *toward the planted foot*. Left lifting -> lean right; right lifting -> lean left. Input must be present throughout most of the lift.
- **Brace:** Limited duration, cooldown. Useful for hazards and emergencies but **not** a substitute for correct team input.
- **Failure:** Wrong foot, missing weight transfer, missing arm counterbalance, short/long lift, or lifting two feet produces a named slip and loses momentum. Three repeated missteps or excessive unsteadiness cause a recoverable faceplant.
- **Success:** The team earns a foot plant with real forward impulse, plus momentum carried from earlier coordinated steps. Uncontrolled button repetition cannot create impulse.

The current implementation uses a simplified assisted angular/spring model. Before shipping climbing and swinging, we must prototype properly constrained joints and motor control using Matter.js or Rapier. The logic gate makes success dependent on coordination today, but does **not** establish that final rigid-body physics is solved.

## Cake Carry
Two arm players must keep the tray supported; left and right legs alternate and the torso manages body weight. A missing grip or excessive tray angle drops a layer and returns the player to a checkpoint with lost momentum. The game remains recoverable, but a full cake and clean run requires coordinated control. The intro does not punish idle teams before the first successful step.

## 23-player game format
Five puppets simultaneously; five team sizes: **5/5/5/4/4**. Five-player teams assign one body part to each person. Four-player teams receive one dual-leg operator, separate left/right arm operators and torso. The dual-leg input provides *no* extra physics power and needs real playtests for fairness.

Each phone should display only its own controls, current event role and any relevant local feedback. Only the TV shows all five puppets, so players must communicate aloud rather than make one person drive everything. Roles rotate **between events**, not unpredictably mid-challenge. Each event must offer continuous meaningful input and recoverable failure for all roles.

## Design for the full Olympics
| Event | Legs | Arms | Torso | What creates comedy |
| --- | --- | --- | --- | --- |
| Walk, You Idiots! | Alternate timed footholds | Opposite-arm counterbalance | Continuous support-weight transfer | Mistimed steps, slips, recoveries |
| Don't Drop the Cake! | Move slowly together | Maintain two-sided tray grip and stabilize load | Limit tilt and acceleration | Wobbling desserts, dropping layers |
| Impossible Climb | Step into reachable footholds | Alternate grab, lock, and release | Maintain hanging balance | Missed handholds and upside-down recovery |
| Swing for Your Life | Tuck/extend legs to pump | Time rope grabs and releases | Build and correct swing momentum | Premature releases and failed landings |
| Puppet Olympics | Apply learned actions to changing obstacles | Assist carrying, climbing and finishing | Coordinate dynamic recovery | Earned dramatic close finishes |

## Fairness, pacing and coaching
- Five lanes on the TV must remain visible during active events. Do not let replays hide active physics.
- Give a brief clear tutorial and readable next-action, stability and mistake feedback. Competence should improve through practice.
- Place obstacles and checkpoint spacing so coordination determines results, not randomized physical advantage.
- Finish line ranking: finish time, then progress. Cake mode separately tracks intact layers and elapsed time.
- Falling should waste a modest amount of time but never permanently eliminate a team.
- As a team becomes skilled, accelerate challenge demands **through terrain, load and handholds**, not arbitrary random control inversion.

## Definition of done for multiplayer
Not achieved yet. Requires five simultaneous puppet rigs, genuine phone-specific role assignment, room server and reconnection, a latency/jitter test, four-vs-five-player accessibility assessment, and a **real 23-device room test**. Until those work, the public URL is a local coordination playground rather than the full party game.

## Proven v0.2 regression scenarios
- Single left-leg repeated spam: no success, no distance gained, falls occur.
- Arms only: no forward movement.
- Alternating legs with no torso / no arms: no successful steps.
- Two legs lifted simultaneously: fall.
- Long lift: slip/failure.
- All roles synchronizing correctly: forward progress and eventual finish.
- Cake with incomplete grips: no legitimate step or loses cake; correctly gripped coordinated walk progresses.
- Stable deterministic scoring, checkpoints and recovery.