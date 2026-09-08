# Voucher export

Owner: Voucher. Queue: `export`. The worker renders only the authorization snapshot, neutralizes spreadsheet formulas, verifies object integrity, and exposes a five-minute one-time download.

Credential exports contain restricted plaintext and require step-up plus maker-checker proof. Never extend a link or recover a consumed link; create a newly approved export.

## Trigger, impact and owner

Trigger is an approved export request bound to an immutable authorization snapshot. Impact is delayed operations or disclosure of credential plaintext. Voucher owns the run; Security and Object Storage owners join.

## Stop loss and diagnosis

Stop loss revokes the affected unconsumed download and pauses its export job. Diagnosis checks step-up, maker-checker proof, snapshot/hash, row scope, formula neutralization, KMS/object integrity, expiry and one-time consumption.

## Recovery and data repair

Recovery creates a new approved export after dependency repair; never reuse or extend a consumed/expired link. Data repair may recreate an object only from the frozen snapshot through the standard worker.

## Validation, escalation and audit

Validation verifies scope, count, encrypted object hash, formula safety, five-minute expiry, one-time download and zero log leakage. Escalation is immediate for unauthorized access or plaintext exposure. Audit stores request/snapshot/object references, proof, Job/Trace and download receipt without secret values.

## Postmortem

Exposure, authorization bypass, integrity mismatch or SLO breach requires a Postmortem.
