# Invitation cleanup

Owner: Identity. The queue, concurrency, timeout, retry, lease and schedule are read from the canonical runtime Job Catalog and are not repeated here.

Trigger conditions: cleanup lag beyond two schedules, growing expired live-row counts, claim backlog, repeated dead letters, lock-wait alerts, or an `identity_invitation_stale_total` anomaly. Impact includes blocked invitation redemption, leaked campaign capacity, delayed PreAuth expiry and elevated login-database load. The incident owner is Identity; Reliability owns database capacity and job infrastructure, and Security joins for suspected replay or disclosure.

The job advances expired active invitations to `expired`, advances timed-out `reserved` or `proofpending` claims to `expired`, expires active `invitationproof` or `enrollment` PreAuth records, and removes expired invitation rate windows. Each class is processed by bounded pages in independent short transactions with row-level `SKIP LOCKED` claims. Invitation expiry events are committed to the Outbox in the same transaction; the job never sends notifications directly.

## Diagnosis

- Check the stable job ID `invitationcleanup`, its latest lease, attempt, dead-letter and database error code.
- Inspect counts grouped by invitation status, claim state and PreAuth purpose/state. Never select invitation codes, token hashes, recipients, cookies, tickets, OTP values or request bodies.
- Confirm the expiry indexes exist and query plans use them. Pause the job if a sequential scan, sustained lock wait or replica lag appears.
- Correlate with `identity_invitation_stale_total`, `identity_invitation_claim_active` and the canonical job duration/error metrics.
- Use read-only, aggregate queries scoped to `status/state/purpose` and time windows. Preserve the job ID, trace ID, schema head, plan, lock graph and affected count as forensic evidence; never export secrets or PII.

## Stop loss and containment

- Pause only `invitationcleanup` when it causes lock pressure or a faulty transition. Do not disable invitation authorization, Receipt immutability, RLS, Risk or rate limits.
- If replay or key exposure is suspected, stop new invitation issuance, keep redemption fail-closed, follow `invitationkeyrotation.md`, and preserve the audit and Receipt chain.
- If PostgreSQL capacity is exhausted, shed public invitation traffic before authenticated business traffic. Do not use Redis state or a stale replica to authorize redemption.

## Recovery and validation

- Fix schema, capacity or lock contention first, then requeue the same failed job; all transitions and Outbox writes are idempotent.
- Do not manually delete live invitations, claims, PreAuth rows, immutable receipts, sessions, audit evidence or Outbox records.
- Validate that no expired active rows remain, no live row was changed, Outbox expiry events equal expired invitations, dead-letter growth has stopped and API latency has recovered.
- Escalate suspected credential disclosure or replay to Security and preserve the audit/receipt chain for investigation.

Data repair is forward-only: deploy a reviewed migration or a bounded, idempotent repair job that uses the same row locks, state predicates and Outbox rules. Never mutate or delete `identity.invitationreceipt`. Before reopening traffic, reconcile invitation `use_count` against immutable Receipts and live Claims, Session creation against Receipts, PreAuth state against Claim state, and expiry events against transitioned invitations.

Escalation path: Identity on-call → Reliability database on-call → Security incident commander → release owner. Escalate immediately for cross-organization visibility, Receipt mutation attempts, key exposure, inconsistent Session/Receipt pairs or unexplained replay growth.

## Postmortem and post-incident review

Record the trigger, detection gap, impact window, affected aggregate counts, exact schema/release versions, containment timeline, root cause, repaired invariants, reconciliation evidence, permanent prevention, named owners and due dates. Attach only redacted queries and immutable audit references.
