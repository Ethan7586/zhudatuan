# Runtime cleanup

- Trigger: expired idempotency/session/job metadata exceeds capacity or cleanup dead-letters.
- Impact: database growth and query latency increase; no live business record may be deleted.
- Owner: Platform on-call and DBA.
- Stop loss: pause cleanup on classification uncertainty.
- Diagnosis: inspect retention class, oldest/newest rows, live references, batch cursor and locks.
- Recovery: correct retention configuration and resume bounded batches.
- Data repair: restore mistakenly archived metadata from backup and replay affected audit verification.
- Validation: no live lease/session/idempotency/audit reference removed, table growth and latency return to target.
- Escalation: security for audit retention; DBA for lock or bloat risk.
- Audit: record retention version, range, count and operator.
- Postmortem: include deleted classes and prevention action.
