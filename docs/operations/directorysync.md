# Directory Sync

Owner: Organization. Runtime queue, concurrency, timeout, retry and lease values come exclusively from the `directorysync` entry in `JOB_CATALOG`; the resource lease is scoped to one Directory Connection.

## Trigger and impact

Trigger an incident for sync lag beyond two schedules, a growing cursor backlog, repeated dead letters, a departure event that is not reflected in Access Version, or sustained Provider rate limits. Impact can include stale organization membership, delayed departure revocation and unavailable federated login; the last successful projection remains authoritative and must not be replaced by an empty page.

## Stop loss and diagnosis

Pause only the affected Connection when signature, hierarchy-cycle, cursor-integrity or lock alerts repeat. Do not disable global Access checks, clear the cursor, delete Directory subjects, bypass the resource lease or merge people by name, phone or email. Inspect sync duration, page and item counts, cursor lag, conflict/freeze counts, Provider rate limits, retries, dead letters, the latest successful version and the active `directory:<connection>` lease. Logs and alerts may contain only Provider type, result, hashed Connection identifier and aggregate counts.

## Recovery

Confirm the Connection is enabled, Provider health is not unavailable, its Secret reference resolves, and no competing resource lease exists. Retry the same SyncRun; its encrypted cursor and Inbox event keys make committed pages idempotent. If the Provider is unavailable, keep the last successful membership projection and investigate the Provider before retrying.

## Data repair and validation

Data repair is forward-only through an approved idempotent repair job or migration that uses the same subject keys, Access lifecycle service, Outbox and locking order. After recovery, run a complete reconcile and validate cursor continuity, page checksums, subject counts, conflict counts, organization acyclicity, departure Access Version increments and active-session revocation. Never edit Directory, Membership, Principal or Access tables directly.

## Escalation

Pause the Connection after repeated signature/configuration errors. A departure event is urgent: confirm Access Version increased and active sessions were revoked. Resolve conflicts through the reviewed repair flow; never merge people by name, phone or email.

## Audit and postmortem

Preserve the run ID, hashed Connection ID, schema and release heads, cursor version, aggregate counts, lease evidence, decision reason and immutable Audit/Outbox references. The postmortem records the trigger, impact window, stop-loss timeline, root cause, repaired invariants, validation evidence, prevention work, owners and due dates without copying PII or credentials.
