# Cache failure

## Trigger and impact

Trigger on Redis readiness loss, cache error-rate alert, mass expiry, signature corruption or hit-rate collapse. Public and authenticated reads may become slower but PostgreSQL remains authoritative; no write may depend on cached state. The Runtime owner leads with Database and Commerce on-call.

## Stop loss and diagnosis

Stop cache warming and broad invalidation, preserve request and trace IDs, and prevent retry storms. Confirm whether the fault is connection, authentication, memory pressure, replication, corrupt envelopes or a version-key mismatch. Keep strict database pool and rate limits; never extend stale access, session, price, inventory or entitlement facts.

## Recovery and data repair

Route reads through bounded authoritative queries, restore Redis or promote its replica, rotate the connection reference if required, then warm only versioned hot keys through Singleflight. Rebuild derived keys from current catalog, membership, authorization and capability versions; do not restore cache snapshots as business truth.

## Validation and escalation

Validate zero authorization leakage, zero stale checkout evidence, database pool below 70 percent, normal p95 latency and stable cache signatures. Escalate if the authoritative store approaches saturation, cache state remains unknown or any stale protected fact is observed.

## Audit and postmortem

Archive outage interval, cache and database metrics, key versions, invalidations, warm-up evidence, customer impact and all operator actions. Complete an owner/action/date postmortem and retest total Redis loss.
