# Business metric catalog

Every metric has one owner, minor-unit currency where applicable, an explicit version, scope and projection watermark. Dashboards must expose freshness and never make transaction decisions.

| Dashboard           | Owner     | Metric/version                           | Dimensions                        | Alert                                              |
| ------------------- | --------- | ---------------------------------------- | --------------------------------- | -------------------------------------------------- |
| Order               | Order     | placed/paid/cancelled/count/v1           | scope, mall, provider, period     | order failure rate and expiry lag                  |
| Inventory           | Inventory | available/reserved/oversell/v1           | scope, listing, provider          | negative stock or oversell                         |
| Payment             | Payment   | captured count/amount/v1                 | scope, provider, tender           | duplicate charge, integrity mismatch, callback p99 |
| Refund              | Payment   | requested/succeeded count/amount/v1      | scope, provider, reason           | over-refund or stuck refund                        |
| Voucher             | Voucher   | issued/active/redeemed/reversed/value/v1 | scope, program, provider          | duplicate redemption or pool exhaustion            |
| Benefit             | Benefit   | budget/granted/available/frozen/v1       | scope, kind, batch                | budget breach or duplicate grant                   |
| Provider            | Channel   | health/circuit/error/lag/v1              | connection, provider, operation   | circuit open, statement mismatch, sync lag         |
| Finance             | Finance   | debit/credit/balance/difference/v1       | scope, account, partner, period   | journal imbalance or reconciliation difference     |
| Support SLA         | Support   | first response/resolution/escalation/v1  | scope, priority, queue, agent     | deadline breach                                    |
| Reporting watermark | Reporting | offset age/rebuild hash/v1               | scope, projection, metric version | watermark lag or rebuild mismatch                  |
| Access denial       | Access    | allow/deny/challenge/review/v1           | operation, scope kind, reason     | cross-scope denial anomaly                         |
| Risk decision       | Risk      | allow/challenge/review/deny/v1           | policy version, operation, scope  | deny spike or policy replay difference             |

Initial SLO values are owned by [config/telemetry.yml](../../config/telemetry.yml); capacity inputs are owned by [config/capacity.yml](../../config/capacity.yml). Runbooks and alerts reference these sources instead of copying thresholds.
