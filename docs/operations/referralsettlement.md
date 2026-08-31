# Referral settlement worker

## Trigger and impact

Trigger on dead letters, balance conflicts, finance posting mismatch, expired claim or queue age above five minutes. Commission availability and withdrawal completion may be delayed; balances must never be guessed. The Referral owner leads with Finance and Reliability owners.

## Stop loss and diagnosis

Pause the affected settlement partition, keep Job ID, scope, commission and withdrawal business keys, and stop external payout when the outcome is unknown. Inspect due-at ordering, optimistic versions, append-only movements, current claim, Finance journal and deterministic posting key. Never update a commission, movement, withdrawal or journal directly.

## Recovery and data repair

Verify the Finance economic leg before replaying. If no leg exists, replay the original Job in its fixed batch; if the leg exists, reconcile Referral state using the same deterministic key. Resolve an unknown payout through provider query before retrying and send terminal failures to `runtime.deadletter`.

## Validation and escalation

Validate one settlement or reversal movement per commission, one withdrawal claim result, balanced Finance entries, monotonic versions, zero negative available balance and a declining queue age. Escalate on unknown payout, duplicate economic leg, cross-scope record or an unreconciled difference.

## Audit and postmortem

Archive Job and business keys, batch range, Finance journal, provider evidence, before/after balances, retries and reconciliation. Complete an owner/action/date postmortem and repeat settlement plus replay tests.
