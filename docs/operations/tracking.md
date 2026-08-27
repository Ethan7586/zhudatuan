# Tracking

- Trigger: tracking watermark is stale, callback order is invalid, or tracking job dead-letters.
- Impact: customers and support cannot see current fulfillment progress.
- Owner: Fulfillment on-call.
- Stop loss: keep last verified milestone; do not regress fulfillment state on an older event.
- Diagnosis: compare provider milestones, external IDs, occurrence times, stored sequence and connection health.
- Recovery: pull a full provider snapshot and replay missing milestones in order.
- Data repair: append missing evidence; never rewrite a completed milestone.
- Validation: milestone IDs are unique, state is monotonic and customer projection watermark advances.
- Escalation: supplier owner when promised delivery is at risk.
- Audit: record source, event hash, accepted/rejected reason and replay actor.
- Postmortem: document out-of-order cause and mapping fix.
