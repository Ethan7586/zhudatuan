# Voucher expiry

- Trigger: active vouchers pass expiry without transition or expiry job dead-letters.
- Impact: expired value may remain usable or reserved funds may not be released.
- Owner: Voucher on-call with Finance owner.
- Stop loss: reject redemption by command-time expiry check independent of the projection.
- Diagnosis: inspect voucher state, expiry, holds, redemption/reversal and batch attempts.
- Recovery: replay expiry shards using voucher ID as the stable key.
- Data repair: append a state event and financial release/compensation where policy requires.
- Validation: no expired voucher is redeemable, state history is monotonic and financial totals reconcile.
- Escalation: P0 for successful post-expiry redemption.
- Audit: record policy version, transition, amount and repair actor.
- Postmortem: include lag and prevention action.
