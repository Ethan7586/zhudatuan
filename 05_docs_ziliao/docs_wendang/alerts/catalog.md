# Alert catalog

| Severity | Signal | Automatic protection | Runbook |
| --- | --- | --- | --- |
| P0 | Duplicate charge or payment integrity mismatch | freeze affected payment/provider writes | `05_docs_ziliao/docs_wendang/runbooks_yunwei/paymentincident.md` |
| P0 | Journal debit differs from credit | block settlement, withdrawal and invoice | `05_docs_ziliao/docs_wendang/runbooks_yunwei/ledgerrepair.md` |
| P0 | Suspected cross-scope disclosure | revoke sessions and freeze operation | `05_docs_ziliao/docs_wendang/runbooks_yunwei/crosstenantincident.md` |
| P0 | Negative stock or accepted oversell | freeze affected stock writes | `05_docs_ziliao/docs_wendang/runbooks_yunwei/inventoryrepair.md` |
| P0 | Broad order creation failure | stop promotion and nonessential releases | `05_docs_ziliao/docs_wendang/runbooks_yunwei/releaserollback.md` |
| P1 | Refund stuck or provider ambiguity | stop new attempt and query provider | `05_docs_ziliao/docs_wendang/runbooks_yunwei/refundrepair.md` |
| P1 | Provider circuit open or sync lag | isolate affected connection | `05_docs_ziliao/docs_wendang/runbooks_yunwei/channeldegrade.md` |
| P1 | Outbox/dead-letter accumulation | pause affected partition | `05_docs_ziliao/docs_wendang/runbooks_yunwei/outboxreplay.md`, `05_docs_ziliao/docs_wendang/runbooks_yunwei/deadletterreplay.md` |
| P1 | Database primary unavailable | freeze strong-consistency writes | `05_docs_ziliao/docs_wendang/runbooks_yunwei/databasefailover.md` |
| P2 | Reporting watermark stale | mark reports stale | `05_docs_ziliao/docs_wendang/operations/projection.md` |
| P2 | Support SLA breach | assign/escalate affected cases | `05_docs_ziliao/docs_wendang/operations/supportsla.md` |
| P3 | Bundle/capacity budget drift | block release candidate | `05_docs_ziliao/docs_wendang/runbooks_yunwei/releaserollback.md` |

Alert payloads carry request/trace/correlation ID, scope, module, operation, result/error code, duration and version. They never carry credentials, cookies, OTP, card secrets, full phone numbers or addresses.
