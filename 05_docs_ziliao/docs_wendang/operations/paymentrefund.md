# Payment refund

- Trigger: refund is processing beyond SLO, provider failure, amount mismatch or dead letter.
- Impact: customer funds and after-sale closure are delayed; refundable balance remains reserved.
- Owner: Payment on-call with Finance owner.
- Stop loss: stop new attempts for the refund ID; query before any resubmission.
- Diagnosis: inspect refund, provider attempts, original tender allocation, capture/refunded totals and inbox.
- Recovery: query the deterministic refund reference first; use `payment.recoveries.resolve` with `retryrefund` only after a definitive provider failure, or `replay` for the exact dead-letter payload. Both paths create a new recovery-linked job and preserve the failed job.
- Data repair: post verified refund effects and adjustment entries, never edit captured totals directly.
- Validation: cumulative refunds do not exceed capture, each refund leg follows the immutable original tender, journal balances, benefits/vouchers reverse exactly once and the exact after-sale resolves once.
- Escalation: P0 for over-refund or duplicate refund; finance controller for ledger mismatch.
- Audit: store reason, approver, provider reference, amount and repair evidence.
- Postmortem: attach idempotency proof and control action.
