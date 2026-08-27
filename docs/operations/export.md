# Reporting export

- Trigger: export exceeds deadline, object write fails, CSV safety check fails or dead letter appears.
- Impact: authorized user cannot download a report; interactive reports remain available.
- Owner: Reporting on-call.
- Stop loss: revoke incomplete object URLs and preserve frozen scope/filter/version.
- Diagnosis: inspect export state, scope snapshot, cursor, row count, object hash and attempts.
- Recovery: replay from stable cursor into a new immutable object and short-lived download grant.
- Data repair: delete/quarantine partial objects through object lifecycle, not database state edits.
- Validation: row count/hash match, CSV formula cells are escaped, sensitive columns are absent and expiry is enforced.
- Escalation: security for data exposure; object-storage owner for persistent failures.
- Audit: record filter, scope, row count, hash, expiry and downloader.
- Postmortem: include size/capacity and authorization evidence.
