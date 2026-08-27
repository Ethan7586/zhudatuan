# Audit archive

Owner: Audit. Queue: maintenance. Job kind: `auditarchive`.

The job selects records older than the effective hot-retention window, preserves chronological order and the first/last integrity hashes, encrypts the immutable batch with KMS, uploads it under a deterministic content identity, verifies object metadata, and only then commits the archive reference and removes the hot rows in one database transaction. Full batches schedule the next chunk immediately; an empty or partial batch schedules the next hourly scan.

## Alerts

- `AUDIT_ARCHIVE_OBJECT_MISMATCH` or `AUDIT_ARCHIVE_OBJECT_HASH_MISMATCH`: quarantine the referenced path and investigate object-store integrity before retrying.
- `AUDIT_ARCHIVE_REFERENCE_CONFLICT`: do not delete hot records; compare the existing database reference with the immutable object.
- `AUDIT_ARCHIVE_SOURCE_CHANGED`: do not retry by hand. Confirm there is one active worker for the claimed job and inspect unexpected mutation attempts.
- `AUDIT_ARCHIVE_OBJECT_TOO_LARGE`: inspect oversized evidence and reduce the archive batch only through a reviewed code change.

Never edit or delete `audit.archiveref` rows or immutable archive objects. Legal hold is controlled by `audit.retention`; while active, the corresponding scope is not archived or expired.

## Impact and containment

An archive failure does not make hot evidence mutable, but sustained failure increases primary storage and recovery time. Stop repeated manual job creation, keep the last failed job and immutable object intact, and set legal hold for a scope only with approved legal/security authority. Do not bypass the immutability trigger or delete source rows manually.

Stop loss: preserve hot rows, archive references, the uploaded immutable object and the failed job until their hashes have been compared.

## Diagnosis

Correlate the job id, scope, first/last hash, object reference and database trace. Check the dead letter, object metadata, KMS key version, `audit.archiveref`, hot-row count and the effective `audit.retention` row. Confirm the scheduled job is unique before restarting workers.

## Recovery

The object path is deterministic. A retry first reads and validates an already uploaded envelope, then resumes the database commit without overwriting the object. If the hot rows were already removed, preserve the archive reference and close the duplicate job after confirming the last hash and row count.

## Data repair and verification

Repair only by a reviewed forward migration or a new idempotent job. Verify that the archive object hash/size/key version match `audit.archiveref`, the first and last chain hashes match the encrypted manifest, the archived source ids are absent from hot storage, the next hot record references the archived last hash, and a scoped audit query returns the archive reference without exposing another scope.

Validation: record the compared row count, first/last chain hash, object digest, KMS key version, scope-isolation result and restoration sample.

## Escalation and postmortem

Escalate hash mismatches immediately to Security and SRE; escalate retention or legal-hold ambiguity to Legal before any retry. Record containment, evidence, approvals, repair migration/job, verification results and recurrence prevention in the incident audit. A postmortem is mandatory for integrity mismatch, unauthorized mutation attempt, cross-scope visibility, lost evidence or an archive backlog beyond the storage SLO.
