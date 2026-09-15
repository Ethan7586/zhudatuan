# RV-0004｜Outbox 与 Runtime Scheduler 控制面独立复核

## 边界与方法

- 固定审计基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 从 release target/remote policy/systemd 反查各生产 worker entry，再从唯一 relay/scheduler 构造点反查 staging 运行限制；未查询生产数据库积压、未启动 worker、未重放事件。

## 独立事实链

1. `OutboxRelay.ts:11-37` 认领未发布 outbox 行、发布后标记 published，失败时记录失败；`RuntimeEventPublisher.ts:8-27` 将 event 去重投递为 `runtime.job`；`RuntimeScheduler.ts:11-42` 定期投递订单/券/权益到期与 cleanup job。
2. 全仓非测试源码存在多个 `insert into runtime.outbox` producer，其中支付结算、风控、订单、权益、客服、身份、扩展、通知与财务模块均包含写入点；release policy 将 Purchase/Web/Catalog/Payment webhook/Support 等 API 作为生产 target 部署，不能将 outbox 视为纯测试数据结构。
3. `JobsMain.ts:1-25`、`FullJobsMain.ts:1-35` 是唯一 production-source 中构造 `OutboxRelay` 与 `RuntimeScheduler` 的位置。两者将 relay/scheduler 与完整 job registry 并发运行。
4. `IdentityNotificationJobsOnlyMain.ts`、`CatalogJobsMain.ts`、`PaymentJobsMain.ts` 及相应 runtime 不构造 relay/scheduler；remote policy 只将这三类专用 Jobs 作为正式 job deployment，且 `rg` 未找到正式 policy/systemd/workflow 对 `JobsMain` 或 `FullJobsMain` 的部署引用。
5. staging 的 `zhudatuan-staging-full-jobs.service` 才引用 `JobsMain.js`，但 service 明确以 `ExecCondition=/usr/bin/false` fail closed；staging readiness 同样要求它保持 inactive。因此它不是可用的生产替代控制面。
6. `04_tools/scripts/audit/mvp-kernel.mjs` 也构造 relay，但它是审计脚本，既无 release target 也无 systemd/worker 注册，不能承担运行职责。

## 裁决

- **F-0022 确认 P1，高置信度。** 正式可部署 API 可将事件原子写入 `runtime.outbox`，但负责 claim→publish→job 以及周期 cleanup 的唯一实现没有正式运行 target；专用 workers 不是等价替代，staging 聚合 worker 又被刻意禁止启动。异步派生状态、通知与到期处理可长期不发生。
- 生产 outbox 行数、最旧积压、具体 event type 与图外进程未读取，故不声称已丢失数据或某个业务事件已受影响。
- 不是 P0：没有当前严重数据事故或全系统中断的直接证据；outbox 事务写入本身保留了后续恢复/重放的可能。

## 后续独立修复批次的最小范围

1. 从修复时最新 `zdt-next` 建立仅异步控制面分支，先指定单一正式 relay/scheduler owner，再新增或接通一个显式 release target、systemd unit、readiness 与监控。
2. 在隔离数据库验证 event id 去重、claim lease、发布失败、重启恢复、scheduler 幂等与 deadletter；不得先清空或重放现有 outbox。
3. 获授权后先只读统计 production backlog/age 与实际 active unit，决定是否需要受控补偿；补偿与 target 接线分为不同小批次。
4. 回滚为停用新增控制面并保留 outbox 行；任何已派发事件按 inbox/event id 去重，不以删除记录回滚。

本复核未修改 worker、队列、数据库或线上服务。
