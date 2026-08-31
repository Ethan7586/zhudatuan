# Referral event worker

## Trigger and impact

Trigger on dead letters, repeated `REFERRAL_EVENT_CONTEXT_MISSING`, version conflicts, duplicate-effect alerts or processing latency above 30 seconds. Referral commission creation, maturity or reversal may be delayed; Order and Payment truth remains authoritative. The Referral owner leads with Order, Payment and Finance owners.

## Stop loss and diagnosis

Pause only the affected `scopeId + orderId` partition and preserve the original `order.paid`, `order.received` or `refund.completed` Event ID. Inspect Inbox state, source event version and schema, aggregate ordering, referral relationship snapshot, policy version, membership scope and current commission movements. Never manufacture a replacement event or edit a commission directly.

## Recovery and data repair

Fix the immutable source-event mapping or active referral configuration, release an expired lease, and replay the failed Job using its original Event ID. The worker must consume through the runtime Inbox, serialize each scope and order, use optimistic versions, write only Referral-owned tables and publish effects through the Outbox. Repair financial differences through the owning Finance command.

## Validation and escalation

Validate one Inbox effect per Event ID, correct referrer and policy snapshot, monotonic commission version, append-only movement, expected Outbox event and zero changes to Order or Payment tables. Escalate on missing immutable evidence, cross-scope attribution, duplicate commission or any finance mismatch.

## Audit and postmortem

Archive event and job IDs, scope, order, policy version, before/after commission state, retries, reconciliation and approvers. Complete an owner/action/date postmortem and add the failing event shape to the contract suite.
