# Credential import

Owner: Voucher. Queue: `import`. Runtime verifies the object hash and stages 500-row chunks; Voucher validates, encrypts, and writes each row idempotently.

Use the generated error report for permanent row failures. Retry the same import for transient storage, KMS, or database failures. Do not attach the source file to incidents.

## Trigger, impact and owner

Trigger is user confirmation of a scanned and preflighted credential file. Impact is unavailable stock, duplicate secrets or plaintext exposure. Voucher owns the run; Runtime, Security and KMS owners join.

## Stop loss and diagnosis

Stop loss quarantines the object and affected pool. Diagnosis checks authorization snapshot, object hash/type/scan, chunk checkpoint, fingerprints, pool capacity, KMS key reference, row errors, lease and memory bounds without revealing source values.

## Recovery and data repair

Recovery retries the same import for transient failures and skips committed fingerprints. Data repair requires a corrected new file for permanent errors or an approved void/replacement action; committed ciphertext and fingerprints are immutable.

## Validation, escalation and audit

Validation proves total = succeeded + failed, uniqueness, decryptability, capacity, bounded memory and zero plaintext leakage. Escalation covers collisions, KMS compromise, cross-pool rows and count drift. Audit records import/object/chunk hashes, pool, key reference, Job/Trace and approvals.

## Postmortem

Exposure, duplicate credential, invariant failure or SLO breach requires a Postmortem.
