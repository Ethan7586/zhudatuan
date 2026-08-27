# Notification delivery

- Trigger: delivery lag, provider rejection, template error or dead letter.
- Impact: transactional messages are delayed; commerce transactions remain committed.
- Owner: Notification on-call.
- Stop loss: disable only the failing endpoint/channel and respect user preferences and opt-out.
- Diagnosis: inspect dispatch, template version, endpoint state, attempts, provider response and correlation ID.
- Recovery: repair template/connection and replay unsent dispatch IDs.
- Data repair: create a new dispatch for an approved content correction; never mark failed delivery as sent.
- Validation: one delivery per channel/idempotency key, no secret/PII in logs, and preference is honored.
- Escalation: identity owner for OTP outage; support for customer-impacting delays.
- Audit: record template/version, destination hash, outcome and replay actor.
- Postmortem: include failure class and failover action.
