# Catalog sync

- Trigger: `catalogsync` lag exceeds 30 seconds, repeated provider errors, or a dead letter appears.
- Impact: affected provider listings stop advancing; checkout keeps using the last valid published version.
- Owner: Channel on-call; Catalog owner validates product projections.
- Stop loss: disable only the affected connection and preserve its cursor and raw envelopes.
- Diagnosis: inspect `channel.syncrun`, `channel.sourcerecord`, `channel.provideroperation`, job attempts, provider health and cursor watermark by scope.
- Recovery: repair the connection or mapping, replay the same job ID from its saved cursor, and keep per-page hashes unchanged.
- Data repair: quarantine invalid records; use catalog import commands, never direct listing publication.
- Validation: reconcile source/accepted/error counts, listing version, audit chain and storefront visibility.
- Escalation: provider owner at 15 minutes; commerce incident commander at 30 minutes.
- Audit: record connection state changes, replay actor, reason, cursor and resulting watermark.
- Postmortem: attach timeline, provider response classes, affected scopes and prevention action.
