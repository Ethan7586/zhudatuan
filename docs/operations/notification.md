# Notification delivery

## Environment-owned SMS credentials

`shop-jobs` reads exactly one non-secret environment entry, `NOTIFICATION_CONFIG_REF`. The referenced notification document owns the provider endpoint, region, approved sign and approved verification template. Its `sms` object must select exactly one credential source:

- Local and independently managed development environments use `credentialRef`. The reference resolves to a secret containing only `accessKeyId` and `accessKeySecret`.
- Managed staging and production environments use `roleName`. The SMS extension obtains short-lived credentials from Alibaba Cloud IMDSv2 and never stores a long-lived AccessKey in configuration, images, manifests or source control.

The same application binary is used in every environment. Environment selection happens only through deployment configuration and the environment's secret manager:

| Environment | `NOTIFICATION_CONFIG_REF` example | SMS credential source |
| --- | --- | --- |
| Local | `shop/local/notification` | `shop/local/notification/sms` secret reference |
| Development | `shop/development/notification/aliyun` | development-only secret reference |
| Staging | `shop/staging/notification/aliyun` | staging runtime role |
| Production | `shop/production/notification/aliyun` | production runtime role |

Never copy a secret value between environments. Never add `ACCESS_KEY_ID`, `ACCESS_KEY_SECRET`, inline credential fields or environment-name branches to application code. Rotate a referenced key in its owning secret manager and restart only the jobs workload; rotate a runtime role through Alibaba Cloud RAM without changing application configuration. The jobs role needs only the approved SMS send action and must not be reused by API, provider or browser workloads.

Before promotion, verify the referenced sign and template are approved in the target Alibaba Cloud account, send one real OTP to an authorized acceptance phone, confirm the provider returns a non-empty external ID, and complete OTP verification. Logs and evidence may contain only the delivery state, provider, correlation ID and masked destination—never the phone, OTP, AccessKey or Secret.

## Incident response

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
