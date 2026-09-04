# Reporting projection

- Trigger: projection watermark lag, duplicate fact, hash mismatch or dead letter.
- Impact: dashboards and exports are stale; transaction commands remain available.
- Owner: Reporting on-call.
- Stop loss: label data stale and stop publishing an invalid watermark; never query transaction schemas from UI.
- Diagnosis: inspect projection offset, inbox events, fact uniqueness, metric version and source event hashes.
- Recovery: replay from the last committed offset with the same metric catalog version.
- Data repair: rebuild the affected scope/version projection into a new version and atomically activate it.
- Validation: duplicate events do not change totals, rebuild hash matches, and finance/order samples reconcile.
- Escalation: finance for amount disagreement; module owner for malformed events.
- Audit: record offset range, version, rebuild hash and activating actor.
- Postmortem: document lag, affected reports and capacity action.
