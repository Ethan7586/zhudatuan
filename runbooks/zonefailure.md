# Availability-zone failure

## Trigger and impact

Trigger when one primary-region zone loses compute, network, queue quorum member, Redis node or PostgreSQL standby. The Reliability incident commander leads with Runtime, Database and Commerce owners; traffic must continue on the surviving zone within the declared availability SLO.

## Stop loss and diagnosis

Freeze discretionary deployments and disruptive maintenance. Confirm the failed zone, surviving replicas, queue quorum, PostgreSQL writer and synchronous standby state, Redis authority status, connection pool pressure and object-storage reachability. Never promote a database candidate with an unknown WAL gap.

## Recovery and data repair

Shift edge and scheduler traffic to healthy zones, allow topology-spread Deployments to restore minimum replicas, promote only the approved database or cache replica, and keep Jobs fenced by PostgreSQL leases. If the primary region cannot meet RPO/RTO, activate the separate warm-standby region using the database failover procedure.

## Validation and escalation

Validate API, Jobs and Provider readiness, queue quorum, PostgreSQL LSN and RPO at most five minutes, recovery within thirty minutes, zero scope leaks, zero duplicate effects, zero negative inventory and balanced finance. Escalate immediately for a second-zone loss or any RPO breach.

## Audit and postmortem

Archive zone timeline, routing changes, replica and LSN evidence, workload placements, queue and database metrics, invariants and approvals. Complete an owner/action/date postmortem and perform a controlled single-zone drill.
