# Inventory sync

- Trigger: stock watermark lag, negative-stock alert, repeated inventory sync failure or dead letter.
- Impact: new checkout is rejected for uncertain stock; existing reservations remain authoritative.
- Owner: Inventory on-call; Channel owner for provider failures.
- Stop loss: freeze writes for affected stock items and disable only their provider connection.
- Diagnosis: compare provider stock, `inventory.stockitem`, reservations, movements, sync cursor and job attempts.
- Recovery: query provider first, replay from the saved cursor, then release the scoped write freeze.
- Data repair: post an auditable inventory adjustment; never overwrite available or reserved quantity.
- Validation: available and reserved are nonnegative, reservations reconcile to live orders, and oversell count is zero.
- Escalation: P0 for negative stock or accepted oversell; P1 for stale availability.
- Audit: store adjustment reason, before/after quantities, provider evidence and actor.
- Postmortem: include concurrency trace and invariant proof.
