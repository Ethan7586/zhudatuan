# Migration rollback

## Trigger and impact

Trigger when migration checksum, target assertion, upgrade rehearsal or readiness fails. Owner is DBA plus release commander; new application instances remain out of service.

## Stop loss and diagnosis

Stop rollout and all schema writers. Capture migration head, failed SQLSTATE, locks, role/grant state and source/target reconciliation. Do not edit an applied migration or add a compatibility view.

## Recovery and data repair

Restore the pre-cutover database snapshot and deploy the exact prior signed application artifact. Correct code in a new migration and rerun fresh plus production-copy upgrade rehearsals.

## Validation and escalation

Verify 94 historical hashes, all repair migrations recorded by the immutable migration inventory, functions/grants/RLS, business invariants and readiness. Escalate for any checksum divergence or data loss.

## Audit and postmortem

Archive snapshot ID/hash, schema reports, failure query, approvers and rollback times; record preventive test and owner.
