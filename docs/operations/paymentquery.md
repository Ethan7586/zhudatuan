# Payment query

- Trigger: callback absent, payment remains authorizing/pending, integrity mismatch or dead letter.
- Impact: order fulfillment is withheld until payment reaches a verified final state.
- Owner: Payment on-call.
- Stop loss: freeze the affected intent; do not create a second provider order number.
- Diagnosis: compare intent, attempt, provider operation, raw inbox, amount/currency/openid and order snapshot.
- Recovery: use `payment.recoveries.resolve` with `requery` for an intent or `replay` for a payment dead letter; the command records an immutable recovery request and creates a new job linked to it.
- Expiry race: query first; if still pending after expiry, close the provider transaction and query again. Capture a success observed before local cancellation. A success observed after cancellation opens a Critical recovery case and triggers a WeChat-only automatic refund without reactivating the order.
- Data repair: apply the verified provider result once through the Payment process manager.
- Validation: one provider transaction, one capture, one order-paid effect, balanced finance entries and one fulfillment effect; for a late payment, validate a cancelled order, one external-only capture, one automatic refund and no fulfillment.
- Escalation: P0 for duplicate capture or amount/openid mismatch; provider support after 15 minutes.
- Audit: retain provider evidence hash, query actor, transition and downstream event IDs.
- Postmortem: include callback/query chronology and replay proof.
