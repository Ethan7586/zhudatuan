# Directory Reconcile

Owner: Organization. Runtime queue, concurrency, timeout, retry and lease values come exclusively from the `directoryreconcile` entry in `JOB_CATALOG`; the scan uses one global reconcile resource lease.

## Trigger and impact

The daily job detects subjects missing from two complete runs, mapping conflicts and integrity drift. Trigger an incident when a reconcile schedule is missed twice, drift grows across runs, repair records dead-letter, or departure state differs from Access. Impact is a potentially stale authorization projection; reconcile must never silently change permissions.

## Stop loss and diagnosis

Pause reconcile if it causes lock pressure, emits duplicate repair records or reports cross-Connection data. Keep authenticated authorization fail-closed and keep the last successful projection. Inspect the last two completed SyncRuns, page checksums, Provider cursor, Connection state, resource lease, aggregate drift classes and deduplication keys. Never log provider subjects, mobile numbers, email addresses, Secret references or raw payloads.

## Recovery and data repair

Resolve upstream hierarchy cycles, duplicate stable subjects or cursor gaps first, then run an approved Directory Sync and requeue the same reconcile job. Data repair is forward-only through the reviewed repair flow and shared Membership lifecycle service. Do not edit Directory, Membership, Principal, Session or Access tables directly.

## Validation and escalation

Close the repair only after a clean reconcile, stable page checksums, zero unexplained mapping conflicts, correct Access Version increments and confirmed session revocation for departures. Escalate cross-organization visibility, identity collision, unexplained Access drift or repeated signature failures to Organization, Identity, Security and Reliability owners.

## Audit and postmortem

Preserve run IDs, hashed Connection IDs, schema/release heads, drift counts, repair IDs, lease evidence and immutable Audit/Outbox references. The postmortem records trigger, impact, stop loss, diagnosis, recovery, validation, root cause, prevention, owners and due dates using aggregate and redacted evidence only.
