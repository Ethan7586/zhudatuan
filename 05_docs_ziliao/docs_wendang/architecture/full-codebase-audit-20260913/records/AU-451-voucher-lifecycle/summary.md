# AU-451｜券生命周期、额度分配与异步执行

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821041000_voucher_lifecycle.sql`（208 行）。
- 人工审阅迁移的表、约束、回填、RLS、运行契约、事件、索引和断言，并从运行入口反查券模块操作、任务注册、Worker、死信与通知订阅。
- 本轮为静态审阅；未执行迁移、Worker、集成测试或任何线上只读查询。

## 真实运行关系

`voucher.cardlibraries.allocate`、`voucher.programs.manage`、`voucher.reserves.request/decide`、`voucher.batches.issue/retry`、`voucher.status.batch` 和 `voucher.bindings.manage` 由受访问上下文约束的 Commerce 操作处理器进入。迁移持久化计划版本、导入卡库/卡、跨范围额度、预留单、发放批次、状态批次及明细，并以 RLS 将应用会话限定在允许的 scope 内；作业身份可执行后台工作。

发放与状态变更会写入 `runtime.job`。`app/jobs.ts` 注册 `voucherissue`、`voucherstatus`、`voucherexpiry`、`voucherimport`，都有队列、并发、超时、重试、租约和死信配置。`VoucherJobProcessor` 按批次锁定、每 500 条分片发券或处理状态；已完成的分片再次排队，完成后写财务分录与 outbox。导入由 `VoucherImportProcessor`/`PgVoucherImport` 分片加密、暂存、落卡；不可恢复失败经 `VoucherDeadletter` 更新批次并写 `voucher.issue.failed`、`voucher.import.failed` 或 `voucher.status.failed`，通知模块订阅这些事件。

## 数据、并发与边界

- `programversion` 将预留单、发放批次和券实例固定到版本；迁移先回填既有记录再设为非空和复合外键，避免后续变更覆盖历史面额与有效期。
- 导入卡码只保存密文、指纹和密钥版本；指纹全局唯一。卡库额度以 `(cardpool_id, scope_id)` 唯一的 allocation 记录控制，卡与批次以状态/外键约束关联。
- 发放批次对预留单有部分唯一索引；Worker 对批次和卡库加锁，对导入卡采用 `for update skip locked`，并以发放计数上限防止超发。批量状态明细以 `(batch_id, voucher_id)` 去重，并使用 savepoint 隔离单券失败。
- 迁移对新增业务表启用 RLS：应用身份依 `access.scope_allowed` 过滤，作业身份专用于后台处理；卡库和卡的读取还要求拥有库所属范围或已获分配的下级范围。
- 运行契约登记八个读/重试/绑定接口，权限与 capability/entitlement 同步登记；三个失败事件登记在 event catalog，索引支撑 keyset 查询及后台批处理。

## 评审结论

- **G0**：这是当前券生命周期、批量任务和数据隔离的运行基础，存在 API、Worker、任务注册、RLS 与事件消费者，不属于删除候选。
- 未发现本迁移新增且可直接证实的 P0–P3。此前记录的 **F-0241（P1 候选）** 涉及更早券资金写入 RPC 的数据库权限核验；本文件的 scope/RLS 与操作契约不能替代那项独立复核，故维持原编号和结论，不重复计数。
- 设计优点：版本化面额、范围额度、分片事务、死信事件和索引共同构成可恢复的异步发券链路；主要未验证项为迁移在目标数据库的实际执行及 Worker 端到端幂等表现。

## 后续验证与回滚边界

- 后续独立修复批次应从最新 `zdt-next` 新分支验证：跨 scope 卡库分配、审批预留后发券、导入卡并发发放、状态批部分失败、死信重试、事件通知和重复 job claim。
- 该迁移包含既有数据回填与新表/外键，任何回滚必须先评估已产生的券、卡、额度和财务记录；不得在审计分支执行或回滚。
