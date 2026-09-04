# Price sync

- Trigger: `pricesync` lag, stale price watermark, provider rate limit, or dead letter.
- Impact: affected listings cannot receive a new quote; existing signed quotes retain their recorded version until expiry.
- Owner: Pricing on-call with Channel owner.
- Stop loss: pause the affected connection; do not copy stale provider prices into pricing rules.
- Diagnosis: compare `channel.syncrun`, provider operation evidence, source price records, pricing rule version and quote failures.
- Recovery: restore provider health and replay the same cursor with bounded concurrency.
- Data repair: correct mappings through catalog/pricing commands and regenerate projections.
- Validation: sample provider amount, stored minor unit, active rule version and checkout quote evidence.
- Escalation: finance for currency/amount mismatch; provider owner for protocol failure.
- Audit: preserve replay reason, hashes, counts and activating actor.
- Postmortem: document stale duration, rejected checkout count and guardrail change.
