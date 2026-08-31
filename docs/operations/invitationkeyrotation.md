# Invitation key rotation

Owner: Identity and Security. `INVITATION_KEY_REF` points to one Secret Store value containing exactly one current key and at most two previous active keys. Each entry has an immutable, unique version and at least 32 bytes of independent key material. Never reuse Session, Identity, Federation, ReturnTarget or password key material.

## Preconditions

- Open a reviewed change record with operator, reviewer, reason, intended current version and rollback version.
- Confirm API and Jobs run the same release, Contract checksum and migration head.
- Query `identity.invitation_key_readiness(activeVersions)` through the readiness path. Record counts only; never export token or recipient hashes.
- Confirm invitation lookup latency, invalid-invitation rate, `identity_invitation_rate_limited_total`, active Claim count, KMS/Secret Store health and cleanup lag are normal.
- Generate new material in the approved Secret Store. Do not place key material in source, shell history, tickets, logs, metrics or database rows.

## Normal rotation

1. Add the new immutable version as `current`; move the former current version to the first `previous` position. Keep only versions needed by unexpired active invitations, with a hard maximum of three total candidates.
2. Publish the Secret Store version, restart a canary API and Jobs instance, and verify readiness. Startup must fail if any unexpired active invitation uses a version outside the configured ring.
3. Verify new invitation issuance stores the new `token_key_version`; redeem one new invitation and one controlled invitation issued with each previous version. Recipient-bound enrollment and Console proof must also succeed for previous versions.
4. Roll the remaining instances without mixing application releases or key-ring shapes. Watch HMAC lookup P95, invalid invitation ratio, Risk failures, database pool saturation and Session creation failures.
5. Before removing a previous version, wait until `identity.invitation_key_readiness(proposedVersions)` reports `missing_count=0`. Revoke and reissue long-lived Campaign invitations that would otherwise extend the window.
6. Remove the retired version, restart canaries, validate readiness and both Target journeys, then finish the rollout. Preserve only version identifiers, approvals and metric evidence in Audit.

## Rollback

- Before retirement, restore the last known-good ring with the same version identifiers and key material, then restart canaries. Do not invent a new version for unchanged material.
- After a version has been removed and its material destroyed, do not restore it from logs or backups. Revoke affected invitations, issue replacements with the current version and notify recipients through the normal Notification workflow.
- If new material may be disclosed, immediately stop issuance, make a fresh version current, keep uncompromised previous versions only long enough to redeem or revoke known invitations, revoke affected active invitations and preserve Receipt/Audit evidence. Never silently accept the retired legacy hash key.

## Completion evidence

- Readiness shows no active invitation outside the final ring.
- New and retained-version token/recipient tests pass for Console and Storefront.
- No plaintext code, recipient, token hash or key material appears in logs, traces, caches, analytics or incident records.
- Invalid invitation, rate-limit, cleanup, database and Session metrics remain within the release thresholds.
- The change record contains version identifiers, timestamps, approver identities, rollback outcome and revocation/reissue counts.
