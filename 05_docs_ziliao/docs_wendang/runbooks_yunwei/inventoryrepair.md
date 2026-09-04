# Inventory repair

## Trigger and impact

Trigger on negative stock, oversell, reservation mismatch or provider stock divergence. Inventory owner leads; affected checkout fails closed.

## Stop loss and diagnosis

Freeze affected stock-item writes and provider sync. Reconcile stock item, reservations, movements, live order lines, returns and provider snapshot under locks.

## Recovery and data repair

Post a reasoned inventory adjustment and replay missing reserve/release/return effects by business key. Never overwrite counters.

## Validation and escalation

Available/reserved remain nonnegative, reservation sum matches live orders, every movement balances and oversell count is zero. Escalate accepted oversell as P0.

## Audit and postmortem

Store before/after, source evidence, approvers, affected orders and concurrency trace.
