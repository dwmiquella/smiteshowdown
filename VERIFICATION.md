# Version 2 verification

23 automated engine and WebSocket checks passed before deployment. Coverage: same-tick Smite races in either seat order, nonlethal first casts, deadline precedence, spell/environment/attack ordering, unique scoring, energy reservation and overspending, capped regeneration and ready spam, Smite evolution, overlapping spells, stun timing and expiration, committed casts surviving stun, simultaneous Disrupts, skipped attack cadence, pause/reconnect, post-kill fizzles, duplicate/stale/malformed actions, forfeits, seven-round draws, rematch resets, monster rotation, and bounded live history.

The WebSocket integration check creates a room, joins a second connection, rejects a third, verifies reserved spending, rejects a duplicate, and restores a disconnected seat. These automated checks are separate from browser acceptance.

Version 2 public-browser acceptance is pending deployment. Version 1 previously completed a seven-round public two-tab match, refresh recovery, practice, and rematch, but that is not claimed as verification of the new rules.

Known limits: physical two-device/network latency and phone touch testing are not verified. The available browser previously ignored its 390-pixel viewport override. Prototype balance is not a fairness guarantee. Rooms are intentionally ephemeral and reset on deployment.
