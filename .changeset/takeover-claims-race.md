---
'godview': patch
'dsh-godview': patch
'pi-godview': patch
---

Taking over a stale or expired lease can no longer produce two owners. The
takeover removes the stale file atomically and puts a lease another agent
installed in the meantime back untouched, and a new lease is published only
after its content is fully written, so a concurrent claimer never rewrites a
half-written lease. Exactly one agent wins, records the previous owner's
expiry, and the loser gets a conflict.
