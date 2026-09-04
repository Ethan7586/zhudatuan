# Invoice issuance

- Trigger: approved invoice request is not issued, issuer callback fails, or dead letter appears.
- Impact: customer invoice delivery is delayed; available invoice amount remains reserved.
- Owner: Finance on-call with tax service owner.
- Stop loss: keep the deterministic request id and do not create a second issuer reference; a terminal failure becomes `failed` with dead-letter evidence.
- Diagnosis: inspect profile snapshot, encrypted tax identity, amount eligibility, issuer operation and object result.
- Recovery: query issuer by deterministic request id, then reapprove the failed request; the same job and provider idempotency key are replayed.
- Data repair: append status events and replace documents only with a new immutable object version.
- Validation: amount does not exceed settled and uninvoiced eligibility, document hash is stored, original/red relation is complete, status events are append-only, delivery is authorized and audit is complete.
- Escalation: tax/finance owner for rejected identity or amount.
- Audit: retain request/issuer references, amount, profile hash and repair actor.
- Postmortem: document issuer behavior and validation change.
