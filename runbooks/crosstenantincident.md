# Cross-tenant incident

## Trigger and impact

Any confirmed or suspected cross-scope read/write is P0. Security incident commander owns response with affected domain and privacy/legal leads.

## Stop loss and diagnosis

Freeze affected operation/capability and revoke sessions/access version. Preserve audit/access records, traces and database logs; do not broaden queries to investigate from production UI.

## Recovery and data repair

Fix resource-to-scope resolution or RLS/grant, deploy signed artifact, invalidate caches/sessions, and reverse unauthorized writes through domain commands.

## Validation and escalation

Run full 11-scope fuzz/negative matrix, verify no other tenant rows, audit chain integrity and regulatory notification decision. Escalation is immediate to legal/privacy and executive owner.

## Audit and postmortem

Preserve affected subjects/resources, access purpose, exposure window, remediation, notification decisions and owner/date actions.
