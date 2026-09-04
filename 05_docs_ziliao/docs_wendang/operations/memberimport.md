# Member import

- Trigger: import stalls, row errors exceed threshold, object hash mismatch or dead letter.
- Impact: membership provisioning is incomplete; existing accounts remain unchanged.
- Owner: Member on-call with organization administrator.
- Stop loss: pause the import shard and reject duplicate file/business keys.
- Diagnosis: inspect immutable object hash, import rows/errors, organization scope, role and invite mappings.
- Recovery: correct source data, create a reviewed import version and replay incomplete rows.
- Data repair: use membership/access commands for corrections; never update role/scope tables directly.
- Validation: success/skipped/failed counts add to input, no cross-scope member, access versions and audit records exist.
- Escalation: security for accidental cross-tenant content.
- Audit: record uploader, hash, mapping version, counts and correction actor.
- Postmortem: include error classes and validation change.
