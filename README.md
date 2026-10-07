# Smite Showdown

Play: https://smiteshowdown.onrender.com

Source: https://github.com/dwmiquella/smiteshowdown

Original two-player fantasy arena, with an authoritative Node.js/WebSocket server. Seven rounds, one monster each. Create a room, share its link or code, and both ready up. Desktop keys and large touch buttons are provided. The How to Play dialog explains all rules; solo practice uses the same engine with an inert rival.

## Run and deploy

Node.js 22+:

```sh
npm ci
npm test
npm start
```

Local development: http://localhost:3000. `PORT` is supported; the server binds `0.0.0.0`. Localhost is not proof of remote multiplayer.

Render: Node web service from `main`, build `npm ci --omit=dev`, start `npm start`, health check `/health`, one free instance. No secrets, database, or custom domain required. `render.yaml` contains the equivalent standalone configuration. The dashboard creation flow worked after the connector initially requested billing setup. Git pushes auto-deploy. Free instances may cold-start after inactivity.

Rooms are in process memory and expire after two hours. A server restart or deployment clears rooms; refresh and create a new room after updating. Do not scale horizontally without shared room routing and state. Versions of the old client are rejected with a refresh message.

## Version 2 rules

All tuning numbers live in `RULES` in `game.js`.

| Action | Key | Effect | Cost | Timing |
|---|---|---|---|---|
| Auto attack | A | 100 damage on the fixed 500 ms cadence | Free | Starts off each round |
| Smite | S | 600 in round 1, +100 each round, 1,200 in round 7 | Free | 200 ms cast; once per round |
| Burst | B | 250 damage | 1 energy | 400 ms windup; once per round |
| Disrupt | D | Stun rival for 600 ms | 1 energy | 300 ms windup; once per round |

Monsters have 10,000 HP. After a three-second countdown, arena damage deals 200 every second. Start with **3 energy**; recover **1** at the start of rounds 2–7, capped at **6**. Repeated ready requests cannot grant energy. A rematch resets to 3 energy, zero points, and round-1 Smite. Empowered Smite is removed.

### One winning hit

Damage is sequential, never shared. Due spells resolve by scheduled impact tick, then monotonic server acceptance order. If two Smites land in the same tick and the first kills, only its caster gets one point. If it is nonlethal, the second can earn the kill. Client timestamps never influence ordering. Earlier button presses on slower connections are not guaranteed to arrive first.

Within a 50 ms simulation tick, due spells resolve first, arena damage second, auto attacks last. Auto-attack tie order alternates by round (host first in odd rounds, guest first in even rounds), shown in the arena. Arena kills award no points. At most one point is awarded for each monster. After seven rounds the higher score wins; an equal score draws.

### Stun and commitment

Disrupt has a visible windup and stun status/countdown. While stunned, all new actions are rejected and auto attacks skip their scheduled hits; missed attacks do not accumulate. Stun expiration is inclusive: actions are allowed exactly at its expiry tick. Enabled auto attacks resume on their original cadence.

Already committed abilities still land through stun, including Disrupt. This preserves the original no-cancellation rule and lets a player respond during its 300 ms telegraph. Two already committed Disrupts can stun both players. A disconnect freezes casts, damage, and stun timers. A monster kill clears stuns. Later committed spells still resolve, reveal their reserved costs, and fizzle without damage or debuffs. Ready-up waits for those casts to settle.

### Server validation and reconnects

The server owns HP, resources, phases, order, deadlines, and scoring. Inputs are queued to the next tick, adding up to 50 ms before a cast starts. Under load the simulation can slow rather than compress damage into catch-up ticks. Connections have monotonic action sequences to reject duplicates, action whitelists, phase/energy/availability checks, origin validation, message-size and rate limits. Resource costs reserve immediately and reveal to the opponent at impact; clients never submit damage.

Each occupied seat has a random 256-bit reconnect token in that tab's sessionStorage. The room link does not contain it. Refresh the same tab to resume; a third player cannot take an occupied seat. Socket closure/heartbeat detection pauses active matches. After a 30-second grace period, the remaining connected player can claim a forfeit. Reconnecting both before a claim resumes play.

## Visuals and performance

Three original SVG monsters rotate by round: Hollow Sentinel, Thorn Regent, Astral Manta. Their names, silhouettes, palettes, and arena lighting change while mechanical stats stay identical. Smite impacts flash; reduced-motion preferences disable animations. The HP threshold and damage label track Smite evolution. Controls and recaps show Disrupt, regeneration, and single-hit results.

SVGs are small local assets with no external art dependencies. Live snapshots carry only the last 12 events; full round history is sent for recaps. Idle rooms send one update per second, active play retains 50 ms snapshots. Unchanged player panels and round markers are not rebuilt, and completed rounds stop advancing their simulation clock.

## Strategy and balance

Smite growth creates larger late-round finishing windows without forcing energy spending. Burst converts energy into a finishing combo; Disrupt trades direct damage for a short denial window. Its windup exceeds Smite's cast time, so an alert rival can commit before the stun lands. One regenerated energy per round preserves a budget: repeatedly buying both spells drains reserves. An initial +2 proposal was reduced because it would fully replenish both paid spells every round.

The old guaranteed shared-point incentive for auto-attacking lethal ticks is gone. Automatic tie priority remains a disclosed deterministic rule, not perfect fairness; seven odd rounds give the host four priority rounds and guest three. Timing spells away from automatic ticks or changing attack cadence can overcome that preference. Human playtesting remains necessary; no dominant strategy or equilibrium is claimed.

Optional random-event modes, avatar customization, and selectable cosmetics are not included in this update. The core duel stays deterministic; all original non-conflicting room, reconnect, seven-round, tutorial, and practice requirements remain.

## Verification

`npm test` covers server rules and real independent WebSocket clients. See [VERIFICATION.md](VERIFICATION.md) for observed checks and browser limitations.
