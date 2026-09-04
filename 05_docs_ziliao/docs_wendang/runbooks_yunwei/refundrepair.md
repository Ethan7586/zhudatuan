# Refund repair

## Trigger and impact

Trigger on over-refund risk, refund stuck beyond SLO, original-route violation or ledger mismatch. Owner: Payment and Finance jointly own response.

## Stop loss and diagnosis

Freeze the refund ID and related after-sale; query provider state. Compare captured/refunded totals, allocation legs, provider attempts, inbox and finance entries.

## Recovery and data repair

Use deterministic refund reference to query then submit only if absent. Apply verified effects once; corrections use approved adjustment journals and compensation commands.

## Validation and escalation

Assert cumulative refund does not exceed capture, original tender totals match, after-sale resolves once and journal balances. Escalate any excess/duplicate as P0.

## Audit and postmortem

Record requester, approver, reason, amount, provider evidence and correction IDs; attach idempotency proof.
