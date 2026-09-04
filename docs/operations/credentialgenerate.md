# Credential generation

Owner: Voucher. Queue: `batch`. The request transaction reserves capacity; the worker encrypts bounded chunks and records `runtime.jobs` progress.

Retry the same job so deterministic credential IDs skip committed rows. Inspect KMS health and pool capacity. Never put plaintext credentials in logs, tickets, or screenshots.
