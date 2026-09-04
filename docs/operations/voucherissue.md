# Voucher issue

Owner: Voucher. Queue: `batch`. Approval creates one deterministic issue batch. Every item allocates one available credential, creates one voucher, and records a stable receipt. Finance posting and `voucher.issued` are idempotent batch facts.

Retry only failed items marked retryable. Check approval evidence, stock capacity, credential availability, item counters, finance reference, and Outbox fact in that order. Never allocate credentials or edit counters manually.
