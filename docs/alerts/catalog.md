# Alert catalog

| Severity | Signal | Automatic protection | Runbook |
| --- | --- | --- | --- |
| P0 | Duplicate charge or payment integrity mismatch | freeze affected payment/provider writes | `runbooks/paymentincident.md` |
| P0 | Journal debit differs from credit | block settlement, withdrawal and invoice | `runbooks/ledgerrepair.md` |
| P0 | Suspected cross-scope disclosure | revoke sessions and freeze operation | `runbooks/crosstenantincident.md` |
| P0 | Negative stock or accepted oversell | freeze affected stock writes | `runbooks/inventoryrepair.md` |
| P0 | Broad order creation failure | stop promotion and nonessential releases | `runbooks/releaserollback.md` |
| P1 | Refund stuck or provider ambiguity | stop new attempt and query provider | `runbooks/refundrepair.md` |
| P1 | Provider circuit open or sync lag | isolate affected connection | `runbooks/channeldegrade.md` |
| P1 | Outbox/dead-letter accumulation | pause affected partition | `runbooks/outboxreplay.md`, `runbooks/deadletterreplay.md` |
| P1 | Database primary unavailable | freeze strong-consistency writes | `runbooks/databasefailover.md` |
| P2 | Reporting watermark stale | mark reports stale | `docs/operations/projection.md` |
| P2 | Support SLA breach | assign/escalate affected cases | `docs/operations/supportsla.md` |
| P3 | Bundle/capacity budget drift | block release candidate | `runbooks/releaserollback.md` |

Alert payloads carry request/trace/correlation ID, scope, module, operation, result/error code, duration and version. They never carry credentials, cookies, OTP, card secrets, full phone numbers or addresses.
