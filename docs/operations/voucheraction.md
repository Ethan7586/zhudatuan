# Voucher action batch

Owner: Voucher. Queue: `batch`. The processor applies lifecycle actions to an immutable search snapshot and performs scheduled Hold and validity expiry.

Retry only rows marked retryable. Reconcile batch counters against action items before intervention. Never edit voucher state directly.
