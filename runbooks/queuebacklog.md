# Queue backlog

## Trigger and impact

Trigger when queue depth, oldest-message age, outbox lag or dead-letter growth breaches the catalogued SLO. The affected Job or Provider owner leads; checkout, payment recovery, fulfillment, notification or projection freshness may be delayed while synchronous truth remains unchanged.

## Stop loss and diagnosis

Preserve original Job and Event IDs, fencing tokens and partition order. Throttle producers only for the affected queue, prevent uncontrolled retries, and inspect owner, kind, scope, oldest lease, attempts, error code, downstream health, rate limit, bulkhead and database contention. Never mint replacement IDs to bypass idempotency.

## Recovery and data repair

Allow the queue-depth HPA to scale within its declared maximum, isolate a poison partition, release only expired leases, and replay from the last verified cursor with jittered backoff. Move terminal work to `runtime.deadletter`; repair effects using owner commands and original evidence.

## Validation and escalation

Validate monotonic fencing, exactly-once inbox effects, aggregate order, declining oldest age, stable database pool and no duplicate payment, inventory, voucher, benefit or finance movement. Escalate when lag cannot return below 30 seconds, a dependency stays open-circuit or capacity reaches its maximum.

## Audit and postmortem

Record queue and partition, depth curve, Job/Event range, scaling decisions, retries, dead letters, reconciliations and customer impact. Complete an owner/action/date postmortem and repeat the backlog drill.
