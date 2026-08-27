# Inventory import

- Trigger: import lease expires, cursor stops advancing, row failures cross the alert threshold, object integrity fails, or the job reaches `runtime.deadletter`.
- Impact: only the affected scope's stock observations remain incomplete; existing committed stock and reservations remain authoritative.
- Owner: Inventory on-call with the supplying organization owner; Security joins for object-integrity or PII incidents.
- Stop loss: pause the affected import and stock publication, quarantine the immutable source object, and keep checkout fail-closed for stale or invalid stock.
- Diagnosis: compare object reference, MIME, malware scan, SHA-256, staged count, cursor, row errors, reservation commitments, movements, lease and database health.
- Recovery: correct the source file and submit a new import; replay the same job only for a transient failure while its immutable object hash still matches.
- Data repair: use reviewed Inventory commands that append movements; never edit counters, `onhand`, reservations, cursors or error rows directly.
- Validation: total equals succeeded plus failed, the cursor reached total, every stock change has one idempotent movement, available stock is non-negative, and the signed report hash matches storage.
- Escalation: P0 for negative availability, cross-scope writes or corrupted evidence; P1 for a blocked active supplier import beyond its SLO.
- Audit: retain uploader, scope, object reference and digest, scan result, counters, report digest, replay actor and correction reason without row plaintext.
- Postmortem: document trigger, detection latency, affected scopes/SKUs, invariant evidence, recovery, prevention owner and due date.

Queue: `import`. Source: private `text/csv` object whose SHA-256 was verified before the job was accepted.

The worker validates and stages at most 100,000 rows, then applies stable 500-row shards. `cursor_value`, success/failure counters, validation summary and the last error are durable. Each row is isolated by a savepoint; an invalid row cannot roll back another row. Stock adjustments lock the stock item, recheck active reservations, write one idempotent movement and never permit available stock to become negative.

Completion requires a clean, integrity-checked CSV report in private object storage. The API exposes only a five-minute signed report URL. Retries resume from the committed cursor; runtime exhaustion is recorded in `runtime.deadletter`.

CSV columns: `sku`, `location`, `onhand`; optional `safety`, `status`. `onhand` and `safety` are non-negative integers. `status` is `active` or `blocked`.

Alert on repeated `IMPORT_OBJECT_INVALID`, `INVENTORY_IMPORT_STAGE_INCOMPLETE`, `IMPORT_REPORT_COLLISION`, dead letters, or a job whose `updated_at` is older than its lease while in an active state.
