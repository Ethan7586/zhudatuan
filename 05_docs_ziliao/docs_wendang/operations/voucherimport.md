# Voucher card import

- Trigger: an imported card library is created with a clean CSV object reference and SHA-256 digest.
- Impact: the library remains unavailable for issuance until validation and encryption complete.
- Owner: Voucher on-call with Security for KMS failures.
- Stop loss: disable the card library; never download, log or export plaintext card codes.
- Diagnosis: compare object metadata, digest, row errors, encrypted-card counts, duplicate fingerprints and KMS health.
- Recovery: correct the source file and create a new card library; replay only a transient failed job with the original immutable object reference.
- Data repair: repair only metadata or projections with a reviewed forward command; never insert plaintext codes, rewrite fingerprints, or mutate an accepted source object.
- Validation: every accepted code has ciphertext, a unique blind fingerprint and key version; no read operation returns ciphertext; counts equal accepted plus rejected rows.
- Escalation: P0 for plaintext persistence or duplicate allocation, P1 for an unavailable approved issuance batch.
- Audit: retain object digest, scan result, row-number error codes, batch and actor; never retain rejected plaintext.
- Postmortem: for plaintext exposure, duplicate fingerprint, lost rows or repeated KMS failure, document scope, containment, immutable evidence, recovery and prevention owner.
