# Experience publication

## Trigger, impact and owner

Trigger on `ExperiencePublicationFailed`, a scheduled release remaining inactive for more than 60 seconds, an object hash mismatch, or client hash divergence. The impact is limited to the affected mall because the previous immutable publication remains active. The Experience owner leads; Runtime, Object Storage and Security owners join for dependency failure or integrity mismatch.

## Stop loss and diagnosis

Stop new publication for the affected application without modifying its active head. Confirm the `experiencepublish` job, its `runtime.inbox` record, scheduled release, immutable object metadata, stored content hash and active publication. Do not bypass integrity checks, overwrite a content-addressed object or update the application head manually. Treat identical object keys with different bytes as possible tampering and escalate immediately.

## Recovery and data repair

For a transient object-store or database failure, restore the dependency and replay the dead letter through the audited runtime operation. The processor is idempotent by event ID, release ID, immutable object key and content hash. Repair only missing job, inbox or publication records from their authoritative event evidence; never manufacture a published version. For functional rollback, restore a historical version into a new version and publish it through the same validation path.

## Validation, escalation and audit

Validate the application head, active release, active publication, object bytes and hash, Web ETag, Miniapp hash, CDN response and previous-version availability. Escalate any hash collision, cross-mall object reference, repeated replay failure or client divergence to Security and the release commander. Record actor, approval, trace, release/version IDs, before/after heads, object hash, replay count and validation evidence in the audit record.

## Postmortem

For every integrity incident or SLO breach, document the trigger, fault boundary, detection gap, customer impact, recovery duration and corrective controls. Attach immutable evidence and assign owners and due dates before closing the incident.
