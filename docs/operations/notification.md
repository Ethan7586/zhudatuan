# Notification delivery

- Trigger: delivery lag, provider rejection, template error or dead letter.
- Identity OTP alert: the dedicated worker samples its queue every 15 seconds. A due job older than 30 seconds, a failed job, or a running job with an expired lease emits `identity.notification.queue.backlog`, records queue metrics, and opens the deduplicated `runtime.deadletter` source `identitynotification`. Recovery emits `identity.notification.queue.recovered`; the dead letter remains open until an operator reviews it.
- Impact: transactional messages are delayed; commerce transactions remain committed.
- Owner: Notification on-call.
- Stop loss: disable only the failing endpoint/channel and respect user preferences and opt-out.
- Diagnosis: inspect dispatch, template version, endpoint state, attempts, provider response and correlation ID.
- Recovery: repair template/connection and replay unsent dispatch IDs.
- Data repair: create a new dispatch for an approved content correction; never mark failed delivery as sent.
- Validation: one delivery per channel/idempotency key, no secret/PII in logs, preference is honored, and the identity queue has no due job older than 30 seconds.
- Escalation: identity owner for OTP outage; support for customer-impacting delays.
- Audit: record template/version, destination hash, outcome and replay actor.
- Postmortem: include failure class and failover action.
