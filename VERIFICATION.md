# Version 2 verification

23 automated engine and WebSocket checks passed before deployment. Coverage: same-tick Smite races in either seat order, nonlethal first casts, deadline precedence, spell/environment/attack ordering, unique scoring, energy reservation and overspending, capped regeneration and ready spam, Smite evolution, overlapping spells, stun timing and expiration, committed casts surviving stun, simultaneous Disrupts, skipped attack cadence, pause/reconnect, post-kill fizzles, duplicate/stale/malformed actions, forfeits, seven-round draws, rematch resets, monster rotation, and bounded live history.

The WebSocket integration check creates a room, joins a second connection, rejects a third, verifies reserved spending, rejects a duplicate, and restores a disconnected seat. These automated checks are separate from browser acceptance.

Version 2 deployed successfully on Render (commit 74d9fd5d3aa6042e138f49c3abae329fe5046c99). Public two-tab browser acceptance completed: create/join and ready countdown; both auto attacks; Disrupt and Burst spending reduced energy from 3 to 1; recap recorded the 600 ms stun; one auto-attack winner received one point; round 2 regenerated energy to 2, changed the monster to Thorn Regent and Smite to 700; the recap confirmed exactly 700 Smite damage and an environmental kill awarded no points; round 3 regenerated energy again and showed Astral Manta with 800 Smite. No browser console errors were reported. Precise same-tick cast races, seven-round v2 progression and rematch resets are covered by the automated checks, not claimed as manual browser tests.

Known limits: physical two-device/network latency and phone touch testing are not verified. The available browser previously ignored its 390-pixel viewport override. Prototype balance is not a fairness guarantee. Rooms are intentionally ephemeral and reset on deployment.


