# Settlement

- Trigger: approved reconciliation has no settlement, payout fails, or settlement job dead-letters.
- Impact: supplier payable remains outstanding.
- Owner: Finance on-call.
- Stop loss: prevent duplicate payout by settlement business key and hold the affected partner/period.
- Diagnosis: inspect reconciliation approval, settlement version, payable entries, provider operation and approvals.
- Provider configuration: `PAYOUT_CONFIG_REF` points to Secret Store JSON containing HTTPS endpoint, bearer credential and provider code; never put credentials in environment values or the database.
- Recovery: the payout request uses the Withdrawal id as provider idempotency key. A terminal job moves a processing withdrawal to `uncertain` and emits `finance.withdrawal.uncertain`; query the provider first, then use `finance.withdrawals.recover` with evidence to replay the same idempotency key.
- Data repair: use adjustment journal and a new approved settlement version.
- Validation: one payout reference, one `finance.withdrawal.paid` journal, payable cleared once, journal balanced and statement period closed.
- Escalation: finance controller and treasury for uncertain external payout.
- Audit: record approvals, bank/provider evidence hash, amount and actor.
- Postmortem: include exposure and dual-control improvement.
