# Voucher status batch

- Trigger: an activate/disable/extend/void batch is queued, progress stalls, or `voucher.status.failed`/a dead letter appears.
- Impact: some vouchers remain in their previous authoritative state; completed items stay committed and cannot be blindly replayed.
- Owner: Voucher on-call; Finance joins when voiding requires hold release or compensation.
- Stop loss: stop only the affected batch, preserve per-item results and immutable status events, and reject a competing batch for the same vouchers.
- Diagnosis: inspect requested action, expiry, actor/reason, item previous/next states, job attempts, policy rejection codes, holds and dead letters.
- Recovery: repair the dependency and replay the same batch/job identity; the worker independently locks each voucher and commits stable shards of at most 500.
- Data repair: correct projections with a reviewed compensating command; never bypass the state policy, delete history, or update voucher state with direct SQL.
- Validation: requested count equals succeeded plus failed, every succeeded item has one immutable event, redeemed vouchers were not extended/voided, and financial holds reconcile.
- Escalation: immediately escalate double transition, history loss or financial mismatch; escalate a business-critical batch delayed 30 minutes.
- Audit: retain actor, reason, action, expiry, item result/error, old/new state, job ID, retry and reconciliation evidence.
- Postmortem: capture cause, affected scopes/vouchers, recovery, failed controls, residual risks and prevention action.
