# Fulfillment submission

- Trigger: paid suborder is not submitted within SLO, provider timeout, or dead letter.
- Impact: customer order is paid but not accepted by the supplier.
- Owner: Fulfillment on-call with supplier/channel owner.
- Stop loss: isolate the provider connection; never submit a new external reference after timeout.
- Diagnosis: inspect fulfillment state, provider operation, deterministic reference, connection health and attempts.
- Recovery: query provider by reference first, then submit or replay only when absent.
- Data repair: append milestone/state evidence through Fulfillment commands.
- Validation: one external order per suborder, quantities match order snapshot and tracking can start.
- Escalation: supplier owner at 15 minutes; customer support at promised-time risk.
- Audit: record provider evidence, manual decision reason and resulting state.
- Postmortem: capture timeout ambiguity and retry-policy action.
