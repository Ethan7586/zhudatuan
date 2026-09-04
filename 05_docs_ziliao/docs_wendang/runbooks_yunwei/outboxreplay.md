# Outbox replay

## Trigger and impact

Trigger when outbox delivery p99 exceeds 30 seconds or a published effect is missing. Runtime owner coordinates with event owner.

## Stop loss and diagnosis

Pause the affected aggregate partition, not all queues. Inspect event schema/version, aggregate order, attempts, claim lease, destination inbox and error code.

## Recovery and data repair

Release expired lease or replay the original event ID; retain aggregate order and correlation/causation. Never mint a replacement event to hide failure.

## Validation and escalation

Destination inbox processes once, aggregate projection order is correct, audit/trace connects to command and lag returns within SLO. Escalate malformed schema to owner.

## Audit and postmortem

Record event range, actor, reason, before/after offsets, effects and prevention action.
