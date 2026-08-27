# Benefit expiry

- Trigger: pending lots miss their effective time, active lots pass expiry, or the expiry job dead-letters.
- Impact: employees cannot use an effective grant, or expired welfare value remains spendable.
- Owner: Benefit on-call with Finance owner.
- Stop loss: command-time availability uses active, unexpired lots and active holds; pause the affected grant batch for disputed activation.
- Diagnosis: inspect lot, movement, grant item, reservation, budget and the idempotent Finance journal business reference.
- Recovery: replay the scheduled expiry shard; activation and expiry use stable lot or batch/member references.
- Data repair: append compensating Finance journals and lot movements; never edit a projected balance.
- Validation: pending due count and active expired count are zero, holds remain protected, budget and Finance entries reconcile, duplicate journals are zero.
- Escalation: P0 for a successful spend after expiry or an unbalanced journal; Finance controller owns monetary disputes.
- Audit: preserve plan version, frozen audience hash, timezone, effective/expiry instant, movement source and repair actor.
- Postmortem: include scheduler lag, affected members, amount, idempotency evidence and prevention action.
