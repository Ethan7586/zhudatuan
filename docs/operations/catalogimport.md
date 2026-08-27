# Catalog import

- Trigger: import stalls, schema drift, row errors, hash mismatch or dead letter.
- Impact: draft products/listings are incomplete; no invalid item is published.
- Owner: Catalog on-call with supplier/channel owner.
- Stop loss: quarantine the object and pause the scope import.
- Diagnosis: inspect object hash, mapping version, source IDs, row errors, category and ownership scope.
- Recovery: correct mapping/source and replay incomplete stable row keys.
- Data repair: use catalog commands and review queue; never direct-update published listings.
- Validation: input count equals success/skipped/failed, source IDs are unique and publication remains separately approved.
- Escalation: supplier owner for source error; security for unsafe content.
- Audit: store source hash, actor, mapping version and row disposition.
- Postmortem: document schema change and contract action.
Owner: Catalog. Queue: `import`. The source must be a private, malware-clean `text/csv` object whose SHA-256 matches the command.

The worker stages at most 100,000 rows and applies stable 500-row shards with a durable cursor. Every row runs behind a savepoint. Completion requires a private CSV report containing every rejected row number and normalized error; the read operation issues only a five-minute signed URL. Retries resume from the committed cursor and exhausted jobs enter `runtime.deadletter`.

Required CSV columns are `title`, `sku`, and `category`; `type` and JSON `attributes` are optional. Product ownership is fixed to the authorized supplier scope. Do not repair failures by editing Catalog tables: correct the source file and submit a new import.
