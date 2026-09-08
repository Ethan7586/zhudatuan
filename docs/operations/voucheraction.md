# Voucher action batch

Owner: Voucher. Queue: `batch`. The processor applies lifecycle actions to an immutable search snapshot and performs scheduled Hold and validity expiry.

Retry only rows marked retryable. Reconcile batch counters against action items before intervention. Never edit voucher state directly.

## Trigger, impact and owner

Trigger is an approved lifecycle action or scheduled hold/validity expiry. Impact is an incorrectly usable or unusable voucher. Voucher owns the run; Support, Finance and Security join for customer or fraud impact.

## Stop loss and diagnosis

Stop loss freezes the affected immutable snapshot and batch, not the whole voucher service. Diagnosis checks approval, snapshot watermark, item versions, active holds, transition policy, counters, lease/fencing and Outbox.

## Recovery and data repair

Recovery retries retryable items using original keys. Data repair uses a new approved compensating action or refund; direct state updates and snapshot edits are forbidden.

## Validation, escalation and audit

Validation reconciles snapshot count, item outcomes, voucher timelines, holds and finance effects. Escalation covers cross-holder action, illegal transition, amount drift or mass failure. Audit saves proof, snapshot hash, before/after versions, Job/Event/Trace.

## Postmortem

Unauthorized lifecycle changes, financial impact or SLO breach requires a Postmortem.
