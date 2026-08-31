# Federation Cleanup

Owner: Identity. Runtime queue, concurrency, timeout, retry and lease values come exclusively from the `federationcleanup` entry in `JOB_CATALOG`.

## Trigger and impact

Trigger an incident for cleanup lag beyond two schedules, growing expired live rows, repeated dead letters or retention-policy mismatch. Impact includes retained one-time verifier material, PreAuth table growth and elevated login latency; active Federation links and sessions must remain unaffected.

## Stop loss and diagnosis

Pause only this job if a predicate, version or lock anomaly appears. Never bulk-delete active transactions, Federated Identity links, LinkCases, sessions or audit evidence. Check database availability, schema head, lease, dead letters, state/expiry aggregate counts and trigger/version errors without reading verifier, nonce, code, token or Return Target values.

## Recovery and data repair

Retry the same job after fixing capacity, indexes or predicates; retry is safe because only nonterminal expired records and already-expired PreAuth rows are selected. Data repair is forward-only through a reviewed bounded migration or idempotent job using the same state and retention predicates. The job expires unfinished federation transactions, retires verifier and Return Target material, and removes expired or consumed PreAuth rows only after the retention window.

## Validation and escalation

Validate that no eligible expired rows remain, active transaction and link counts are unchanged, login latency recovers and Audit retention evidence remains queryable. Escalate replay indicators, active-row mutation, cross-organization exposure or credential disclosure to Identity and Security immediately.

## Audit and postmortem

Preserve job/trace IDs, schema and release heads, aggregate before/after counts, query-plan evidence, dead-letter references and immutable audit records. The postmortem captures trigger, impact, stop loss, diagnosis, recovery, validation, root cause, prevention, owners and due dates without secret material.
