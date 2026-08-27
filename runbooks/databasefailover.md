# Database failover

## Trigger and impact

Trigger on primary unavailability, write/read divergence, corruption alert or sustained connection failure. API writes fail closed; cached public reads may remain available within declared stale limits. Owner is the database incident commander with Commerce and Security on-call.

## Stop loss and diagnosis

Freeze Payment, Voucher, Inventory, Benefit and Finance writes; keep request IDs and queue leases. Confirm failure domain, replica WAL position, last verified backup, outstanding transactions, schema head and application role. Never promote a replica with an unknown gap.

## Recovery and data repair

Promote the approved replica, rotate connection secret references, restart readiness-gated instances, and release queues in owner order. Restore missing events from durable outbox/raw envelopes; use compensation commands for business differences.

## Validation and escalation

Prove schema head, RPO at most five minutes, order/payment/refund/inventory/voucher/benefit and debit-credit invariants, then meet RTO within thirty minutes. Escalate immediately for corruption, cross-region loss or RPO breach.

## Audit and postmortem

Archive timeline, LSNs, backup/object hashes, approvers, secret versions, invariant report and customer impact. Complete owner/action/date postmortem within two business days.
