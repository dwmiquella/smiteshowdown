# Smite Showdown

An original two-player browser arena with a Node.js authoritative WebSocket server. Original SVG character artwork; no Riot assets or APIs.

Play: https://smiteshowdown.onrender.com

Source: https://github.com/dwmiquella/smiteshowdown

## Run

Node.js 22 or newer:

```sh
npm ci
npm test
npm start
```

Open http://localhost:3000 for local development. To test locally on another device, use the host's LAN address and allow port 3000 through its firewall. A local URL is not a public deployment. `PORT` defaults to 3000 and binds to `0.0.0.0`.

## Deploy to Render

Use one Node web service and one instance. Standalone repository: build `npm ci --omit=dev`, start `npm start`, health check `/health`. `render.yaml` supplies the equivalent free-plan Blueprint. No secrets are required.

The source repository is `dwmiquella/smiteshowdown`, with these files at the repository root. Use build `npm ci --omit=dev` and start `npm start`.

Render provides HTTPS and WebSocket upgrades on the service URL. Share that URL, create a room, and send the invitation to the second player. Hosting may cold-start after idle periods on the free plan. Rooms live in process memory: restarts or redeployments clear them. This is a single-instance prototype; do not horizontally scale without a room routing/state design. Rooms expire after two hours, including occupied rooms. This is stated in the tutorial.

## Play

Enter a name and create a private room. The other player opens its link or enters the eight-character code. Both ready up before each round. Keyboard: A toggles auto attacks, S casts Smite, E casts Empowered Smite, B casts Burst. All four have large touch controls. “How to play” contains the complete rules, and solo practice uses the same authoritative engine with an inert second seat, clearly labeled as practice.

Seven rounds, 10,000 HP per monster. Arena damage: 200 each second. Auto attack starts disabled: 100 every 500 ms on a fixed round-relative cadence. Smite: 600 after 200 ms, or Empowered Smite: 850 after 200 ms for two energy. Both share one use per round. Burst: 250 after 400 ms, one energy, once per round. Start each match with six energy and never regenerate it. Energy persists across rounds; rematches reset everything.

## Authority, timing, privacy

All tuning values are in `RULES` in `game.js`. The engine advances in 50 ms steps. Input intentions are queued and processed at the next simulation boundary, after that tick's impacts. Casts are scheduled for 4 or 8 subsequent ticks. Submission therefore includes up to one tick of input quantization plus network latency. Client timestamps never schedule damage. Under server load, simulation may run slower than wall time; it does not catch up with compressed damage ticks. Countdown/cast rendering extrapolates at most two ticks from the server's simulation time. Pauses freeze simulation, while the reconnect deadline uses server wall time.

At each live tick, all due casts, arena damage, and fixed-cadence auto attacks form one damage batch. If lethal, every player who contributed damage in that batch gets one point, including an auto attack contribution. Arena-only kills award none. This can award both players a point, so a drawn match is possible. Final HP is clamped to zero. Recaps report batch HP rather than inventing an order within a batch.

Energy is reserved immediately when an action is accepted, as is action availability. Each player sees their own true balance and the opponent's revealed balance. Opponent snapshots contain only a generic Smite windup, no empowered flag, damage, or reserved cost. Costs reveal at impact. Already committed casts that finish after death still resolve at their scheduled time, reveal spending, and deal zero damage; ready-up waits for them to settle. No cancel action exists.

Every client action has a strictly increasing safe-integer sequence per seat. Duplicate and stale intentions are rejected. Action types, phase, availability, energy, and connection are checked server-side. Maximum WebSocket payload is 2 KB; messages and room creation are rate limited. WebSocket origins must match the host when supplied. Clients have no endpoint for HP, scores, clock changes, or victory claims other than a validated disconnect forfeit.

The room link grants access to an empty seat, not to an occupied seat. A random 256-bit reconnect token is kept in sessionStorage (not the share link). Refresh the original tab to recover the seat; another connection with the same token replaces the older socket. A third player cannot occupy a full room. Disconnect detection uses socket close plus a 10-second heartbeat; after detection, play pauses. After 30 seconds the connected player can claim a forfeit. If both return first, play resumes. Leaving voluntarily keeps the seat reserved until expiration.

## Verification

`npm test` runs engine checks and a real WebSocket integration check. Coverage includes exact cast durations, overlapping abilities, shared Smite availability, immediate energy reservation, hidden network projections, fixed attack cadence, duplicate rejection, lethal batch scoring, environment kills, post-death casts, disconnect pause, forfeit grace, seven-round scoring, and rematch reset. The integration check uses separate sockets to create/join, reject a third seat, verify hidden spending, and restore a disconnected seat. Unit tests advance simulation directly; production exposes no such control.

See `VERIFICATION.md` for the browser acceptance result and deployment verification. No simulated opponent is used as evidence of remote multiplayer.

## Strategy and balance observations

- Act or wait: an early Smite is permanently consumed. Waiting preserves the finishing threat but can lose to an earlier empowered commitment.
- Spend or save: six energy buys three empowerments, six Bursts, or mixed combinations. A synchronized Burst + Empowered Smite does 1,100 damage for three energy, using half the match budget in one round.
- Cooperate or defect: auto attacks shorten the round but move both players toward their finishing windows. Stopping can invalidate a rival's prediction; toggling cannot generate extra attacks.
- Hidden commitment: both Smites have the same visible 200 ms cast. The opponent cannot infer the version from the displayed energy until impact, although prior revealed spending constrains the possibilities.
- Opponent modeling: recaps expose early casts, energy expenditure, attack stops, and lethal batches. Repeated habits can inform later rounds.
- Obvious incentive to watch: because an auto attack in a lethal batch earns a point, keeping attacks on at a predicted lethal attack tick can secure a shared point cheaply. It does not guarantee a point on non-attack ticks. This reduces the exclusivity of Smite timing and may favor draws.
- A correctly aligned 1,100-damage combo beats a 600-damage window, but it costs three energy, has a visible 400 ms setup, and requires timing. No universal dominant strategy or equilibrium is claimed. A player can move the HP trajectory by stopping attacks. No random damage or critical hits are used.
- In the final round, leftover energy has no future value. Spending it when it increases the chance of a needed point has less opportunity cost, but unnecessary early damage can still hand the kill to the rival.

Numbers are prototype values. Human playtesting and latency-diverse testing remain necessary for balance claims.
