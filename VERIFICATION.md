# Verification record

Automated engine and real WebSocket checks: 16 passed, zero failed.

Source is published at https://github.com/dwmiquella/smiteshowdown on main.

Public deployment: https://smiteshowdown.onrender.com. Render confirms service `srv-db2p79nlk1mc738834o0` is a free, single-instance Node service in Oregon, running the `main` branch of `dwmiquella/smiteshowdown`. Deployment `dep-db2p79vlk1mc738835b0` is live. The user successfully created the service through Render's dashboard after the connector creation attempt returned HTTP 402. That earlier blocker is resolved. No error-level application logs were returned during verification.

## Public browser acceptance

Two separate browser tabs, each with its own sessionStorage seat token and WebSocket connection, played against the deployed public server in room `2D50AC5A`. Both were controlled through real browser UI; neither was a simulated opponent. They share a browser profile and physical machine, so this is not a physical two-device or different-network latency test.

- Created a private room; joined the second player by room code.
- Both ready buttons gated the countdown and all seven rounds.
- Auto attacks, Smite, Empowered Smite, and Burst worked. Keyboard A/S worked.
- Reloading the second tab restored Ember QA's original seat and resumed the match.
- A third tab was rejected with “Room full. Rejoin using the original browser tab.”
- Energy carried across rounds and exhausted balances disabled paid actions.
- Rounds 1–4, 6, and 7 awarded shared points for both auto attacks in the lethal tick. In round 5 only Ash auto-attacked, and only Ash earned a point.
- Final result: Ash QA 7, Ember QA 6; the UI declared Ash the match winner.
- Both selected Rematch: round reset to 1/7, both scores to zero, both energy balances to six.
- Closing the rival tab paused the rematch. After the reconnect grace period, claiming forfeit produced “Ash QA wins by disconnect forfeit.” No browser error logs were returned for the primary player tab.
- The rules dialog opened and showed cast timings, costs, hidden commitments, batch scoring, and reconnect rules.
- Separately completed a clearly labeled solo practice round and started its rematch; energy reset to six. Practice is not used as multiplayer evidence.

## Verification limits

Mobile CSS and large action buttons are implemented, but the available browser ignored its requested 390-pixel viewport override (reported width remained 1280). Physical touch interaction and phone-size visual QA remain unverified. No mobile testing claim is made. These tests do not prove competitive fairness across unequal connections or game balance. Original local-preview attempts were blocked by sandbox connectivity; the multiplayer acceptance above ran against the public URL instead.
