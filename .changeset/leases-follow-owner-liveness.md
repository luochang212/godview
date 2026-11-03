---
'godview': minor
'dsh-godview': minor
'pi-godview': minor
---

Leases now follow owner liveness (ADR 31): when a host session dies, its leases stop blocking other agents within one presence TTL instead of living out their claim TTL, and the next claim takes them over with an `owner presence gone` expire event. CLI leases made without a session keep their plain TTL. The prompt context and team_status list only working or blocked peers — idle sessions are visible through team_roster, the explicit full read. Both hosts render peers, claims, and the conflict denial from the shared `godview/report` module, so their outputs no longer drift. A stopping DSH host now closes its sessions out (done, all leases released) the way a disposal does, matching Pi's stop.
