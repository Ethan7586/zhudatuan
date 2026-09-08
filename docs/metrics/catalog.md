# 可观测指标目录

本目录只定义运行健康、技术 SLI 和业务链结果，不提供经营报表口径。经营分析、财务报表和成员销售仍以 Reporting 的版本化指标、Scope、快照和 Watermark 为权威；监控指标允许采样和短期聚合，绝不能用于交易决定、结算或审计事实。

统一阈值、采样和保留期只在 [`config/telemetry.yml`](../../config/telemetry.yml) 定义；覆盖范围和低基数标签只在 [`infrastructure/monitoring/Catalog.yml`](../../infrastructure/monitoring/Catalog.yml) 定义。Dashboard 不复制阈值，显示生效配置版本和数据新鲜度。

## 技术 SLI

| 指标族 | 定义与公式 | Owner | 单位 | 窗口 | Dashboard |
| --- | --- | --- | --- | --- | --- |
| Operation RED | Rate=`sum(count)`；Error=`failure/count`；Duration=`p50/p95/p99(duration)`；覆盖合同目录每个 Operation | Reliability + 模块 Owner | 次、百分比、毫秒 | 5m/1h/30d | 各领域 Dashboard 的 `operationred` |
| Job RED | Rate=`sum(job.count)`；Error=`(retry+deadletter)/count`；Duration=`p95(job.duration)`；覆盖 Job Catalog 每个 Job | Runtime + Job Owner | 次、百分比、毫秒 | 5m/1h/30d | Runtime、领域 Dashboard |
| Provider RED | Rate、失败率、p95/p99，按 11 个 required Provider 与受控 capability/operation 聚合 | Extension + 连接 Owner | 次、百分比、毫秒 | 5m/1h/30d | Provider |
| 模块 USE | Utilization=CPU/内存利用率；Saturation=事件循环/线程池/连接池等待；Errors=运行时错误；覆盖每个模块和工作负载 | Reliability + 模块 Owner | 百分比、毫秒、次 | 5m/1h/14d | Runtime、领域 Dashboard |
| 资源 USE | PostgreSQL、Redis、Queue、Object、CDN、Api、Jobs、Provider、Migration 的利用率、饱和度和错误率 | Reliability | 百分比、数量、秒 | 5m/1h/30d | Runtime |
| 六端 RED | 页面导航 Rate/Error/Duration、查询/写入失败、实时流重连；覆盖 auth/console/storefront/miniapp/store/supplier | Frontend | 次、百分比、毫秒 | 5m/1h/30d | Clients |
| Web Vitals | LCP/INP 取 p75，CLS 取 p75；FCP/TTFB 作诊断；按 Surface/Route/Release 比较 | Frontend | 毫秒、比值 | 1h/24h/28d | Clients |
| Outbox SLI | Lag=`now-oldest unpublished` 的 p99；积压=`unpublished count`；重复效果必须为 0 | Runtime | 秒、条 | 5m/1h/30d | Runtime |
| 数据库 SLI | 查询/事务 p95/p99、连接利用率、锁等待、复制延迟、故障转移状态 | Database | 毫秒、百分比、字节 | 5m/1h/30d | Runtime |

## 核心业务链结果

| 指标 | 精确定义 | Owner | 单位 | 窗口 | Dashboard |
| --- | --- | --- | --- | --- | --- |
| `business.order.success` | 进入已接受订单终态的创建数 ÷ 合法创建尝试数；客户端取消和授权拒绝单独显示 | Order | 百分比 | 5m/1h/30d | Transaction |
| `business.payment.unknown` | 处于 Unknown 且超过首次 Provider 查询时限的支付意图数 ÷ 活动支付意图数 | Payment | 百分比、个 | 1m/5m/24h | Transaction |
| `business.inventory.conflict` | 库存并发冲突数 ÷ 预占尝试数；`accepted oversell` 单独计数且目标恒为 0 | Inventory | 百分比、个 | 5m/1h/30d | Salechain/Transaction |
| `business.provider.orderfailure` | Provider 下单在最终重试后失败数 ÷ Provider 下单尝试数 | Channel | 百分比 | 5m/1h/30d | Provider/Transaction |
| `business.voucher.issuecompletion` | IssueBatch 成功项 ÷ 冻结批次总项；同时显示失败和待处理数 | Voucher | 百分比、个 | 5m/批次/30d | Voucher |
| `business.voucher.redemptionconflict` | 重复/并发核销冲突数 ÷ 核销尝试数；重复生效目标恒为 0 | Voucher | 百分比、个 | 5m/1h/30d | Voucher |
| `business.finance.reconciliationdifference` | 同一冻结 Watermark 下未解决差异的绝对金额和条数 | Finance | 最小货币单位、条 | 15m/期间/保留期 | Finance |
| `business.finance.ledgerimbalance` | 已提交 Journal 中 `sum(debit)-sum(credit) != 0` 的数量，目标恒为 0 | Finance | 条 | 1m/期间/保留期 | Finance |
| `business.import.error` | 拒绝行数 ÷ 已预检行数，按六类 Import 和 Phase 聚合；文件/主体 ID 不作标签 | Runtime + 业务 Owner | 百分比、行 | 5m/任务/30d | Runtime/领域 Dashboard |
| `business.support.slabreach` | 超过冻结 SLA 截止时间且未响应/解决的 Conversation 数 | Support | 个 | 5m/24h/30d | Support/Runtime |

## 标签、采样与证据

指标标签只能来自有限目录或枚举。RequestId、TraceId、CorrelationId、ActorId、MembershipId、TenantId、ScopeId、业务资源 ID、文件名和对象引用绝不成为标签；TraceId/CorrelationId 仅作为采样 Exemplar。未知标签在出口被拒绝并告警。

错误、P0/P1、高风险写和慢请求 100% 保留；普通读请求按配置采样。任何数据必须先经过字段拒绝清单和内容清洗，再进入本地缓冲或外部出口；清洗失败直接丢弃并产生不含原文的安全告警。每张 Dashboard 展示 release、配置版本、数据新鲜度、最近变更和可跳转 Trace 示例。
