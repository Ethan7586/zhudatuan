# Release rollback

## Trigger and impact

Trigger when canary SLO, smoke, security, migration readiness, provider health or reconciliation fails. Release commander owns decision.

## Stop loss and diagnosis

Stop promotion, preserve current/previous signed artifact digests and freeze destructive jobs. Identify application versus schema failure using readiness, traces and invariant reports.

## Recovery and data repair

Redeploy the exact previous signed artifact. If hard-cut schema began, follow database snapshot rollback; do not introduce compatibility routing.

## Validation and escalation

Six clients, API, Jobs, schema head, providers, alerts and core journeys pass; SLO and reconciliation stabilize before reopening release. Escalate any financial/security impact immediately.

## Audit and postmortem

Archive digests, approvals, canary metrics, migration state, rollback timings, customer impact and corrective owner/date.
