# Navigation cache invalidation

## Trigger

Alert when a navigation job reaches the dead-letter state, queue lag crosses the configured threshold, or the navigation health endpoint reports degraded cache availability.

## Impact

Users may temporarily see stale menus or catalog navigation. Authorization remains fail-closed and is never delegated to the cache.

## Owner

The Navigation module owner coordinates recovery; Runtime owns the queue and Inbox infrastructure, while the affected domain owner validates its source event.

## Stop loss

Pause only the failing navigation job kind, keep API authorization active, and disable cache reads if integrity cannot be established. Do not delete Inbox, Outbox, or dead-letter evidence.

## Diagnosis

Confirm Redis availability, inspect the job payload for `eventId`, `event`, `scopeId`, and `payload`, and compare queue fencing tokens with the current worker lease. Verify that the source event exists in Outbox and that its schema version is supported.

## Recovery

Restore the dependency, release an expired lease, and replay the exact dead-lettered job through the standard retry path. The worker invalidates only the affected principal, membership, scope, or catalog cache indexes.

## Data repair

If an index entry is inconsistent, evict the versioned cache key and rebuild it from the owning module's Public Port. Never reconstruct authorization state from cache contents.

## Validation

Verify the affected navigation response against the owning module, confirm the Inbox row is completed once, and check that queue lag and error rate return below thresholds.

## Escalation

Escalate to Runtime for repeated lease or Inbox failures, to the source domain owner for malformed events, and to Security for any cross-scope cache observation.

## Audit

Record the job id, event id, fencing token, affected scope, operator, timestamps, validation evidence, and any manual replay approval.

## Postmortem

Review the source event, retry count, dependency latency, alert timing, and whether capacity or schema controls need adjustment. Reprocessing is safe because the cache event marker and Inbox completion are idempotent.
