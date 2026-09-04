# Dead-letter replay

## Trigger and impact

Trigger for any P0/P1 dead letter or repeated exhausted job. Runtime owner and business owner must approve replay.

## Stop loss and diagnosis

Do not bulk replay. Classify permanent versus transient error, validate payload schema, dependency health, idempotency key, scope and prior partial effects.

## Recovery and data repair

Fix the cause, canary one original job/event ID, then bounded replay. Payment dead letters must be replayed only through `payment.recoveries.resolve` with the `replay` action and a step-up-authenticated operator; this preserves the failed job and links the new job to an immutable recovery request. Permanent invalid input is resolved with a reason, not marked successful.

## Validation and escalation

Check owner invariants, inbox/outbox/job states, audit chain and queue lag. Escalate any unknown partial financial effect.

## Audit and postmortem

Store approvers, selection filter, item IDs, reason, results, ignored items and follow-up owner.
