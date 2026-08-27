# Voucher issue

- Trigger: an approved reserve starts an issue batch, an issue shard stalls, or `voucher.issue.failed`/a dead letter is raised.
- Impact: the affected batch cannot finish and downstream recipients do not receive vouchers; already issued vouchers remain authoritative and must not be issued again.
- Owner: Voucher on-call; Security owns KMS incidents and Finance validates reservation release.
- Stop loss: pause only the affected batch, retain its card locks, allocation, job ID and audit evidence, and prevent a second active issue job.
- Diagnosis: inspect the issue batch, card pool mode/capacity, reserve policy version, allocation counters, KMS key health, job attempts and emitted events.
- Recovery: fix the transient dependency and call `voucher.batches.retry`; the worker resumes from committed counts, locks at most 500 records and requeues only after commit.
- Data repair: use a reviewed compensating command to release unused allocation or restore a missing projection; never edit voucher rows, fingerprints, balances or counters directly.
- Validation: reconcile requested, issued, failed, available and allocated counts; every code has ciphertext, key version and unique HMAC fingerprint; each recipient receives at most one intended voucher.
- Escalation: immediately escalate duplicate codes, plaintext, double issuance or balance mismatch; escalate an approved batch unavailable for 30 minutes to the commerce incident commander.
- Audit: retain batch/reserve/policy versions, job ID, actor, key version, shard counts, failure code, retry reason and reconciliation hash.
- Postmortem: document the timeline, blast radius, invariant at risk, recovery evidence, residual allocation and prevention owner.
