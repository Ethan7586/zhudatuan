# Workload pod loss

## Trigger and impact

Trigger on eviction or abrupt loss of any API, Jobs or Provider pod. The Runtime owner leads; impact should remain within redundancy and PodDisruptionBudget limits, while an in-flight request may retry and an in-flight leased job must be reclaimed safely.

## Stop loss and diagnosis

Do not disable readiness gates or lower disruption budgets. Identify node, pod, release, workload identity, termination reason, active leases, fencing tokens and connection usage. Drain an unhealthy node and prevent a simultaneous second voluntary disruption in the same workload.

## Recovery and data repair

Let the Deployment recreate the pod in another node or zone. API clients retry only idempotent operations; Jobs and Provider workers reclaim expired leases with a newer fencing token. Reconcile incomplete payment, fulfillment and finance work from durable idempotency, outbox, inbox and raw webhook evidence.

## Validation and escalation

Validate minimum replicas, readiness, no lost or duplicate effects, stable queue age, database pool budget and release identity. Escalate if a PodDisruptionBudget is violated, a lease is written by an old fence or more than one failure domain is affected.

## Audit and postmortem

Archive eviction event, node and zone, pod identities, leases, request traces, reconciliation results and recovery time. Complete an owner/action/date postmortem and repeat eviction for API, Jobs and Provider separately.
