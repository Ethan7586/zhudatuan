# Benefit grant

- Trigger: grant batch stalls, budget is insufficient, item failures increase, or dead letter appears.
- Impact: employees receive incomplete welfare balances or vouchers.
- Owner: Benefit on-call with Finance owner.
- Stop loss: pause the batch shard; keep approved budget reserved and reject a second batch key.
- Diagnosis: inspect plan version, frozen audience hash, batch/item/lot states, budget reservation, Finance journals and attempts.
- Recovery: replay incomplete stable shards by batch/item business key.
- Data repair: reverse erroneous grants through compensating entries, never edit account balance.
- Validation: granted count/amount equals successful items, reserved plus granted never exceeds budget, every active lot has one balanced grant journal, and duplicate journals are zero.
- Escalation: finance controller for any amount mismatch.
- Audit: store requester, approver, policy version, batch hash and compensation IDs.
- Postmortem: include affected members and idempotency evidence.
