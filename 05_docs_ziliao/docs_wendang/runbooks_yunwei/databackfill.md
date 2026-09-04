# Data backfill

## Trigger and impact

Use only for approved hard-cut migration or projection rebuild, never as a permanent runtime path. DBA and domain owner jointly own execution.

## Stop loss and diagnosis

Require snapshot, source/target manifest and dry-run reconciliation. Stop on row/count/amount/hash/FK difference or lock budget breach.

## Recovery and data repair

Run deterministic chunks with stable IDs, UTC and minor units; resume by saved cursor. On failure restore snapshot or correct a new offline script.

## Validation and escalation

Verify counts, amounts, inventory, voucher balances, order states, external IDs, hashes, dangling FKs and duplicate keys. Escalate any unknown semantic mapping.

## Audit and postmortem

Archive script hash, source/target snapshot, cursor, results, approvers and cleanup confirmation.
