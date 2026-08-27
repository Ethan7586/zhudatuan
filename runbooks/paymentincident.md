# Payment incident

## Trigger and impact

P0 triggers include duplicate charge, amount/currency/openid mismatch, invalid signed callback accepted, or widespread payment failure. Payment owner leads with Finance and Security.

## Stop loss and diagnosis

Freeze only affected payment/provider writes, preserve callback responses and continue safe queries. Correlate intent, attempt, provider operation, raw envelope, inbox, order and journal by deterministic reference and trace ID.

## Recovery and data repair

Query provider before any retry. Apply one verified final result through Payment jobs; refund late/duplicate capture using original tender and dual approval. Never edit captured totals directly.

## Validation and escalation

Prove one capture effect, correct order state, one fulfillment creation, balanced journal and no extra inventory release. Notify executive/finance/security response for financial or signing compromise.

## Audit and postmortem

Preserve provider evidence hash, certificates, transaction references, actors, approvals, reconciliation and customer remediation.
