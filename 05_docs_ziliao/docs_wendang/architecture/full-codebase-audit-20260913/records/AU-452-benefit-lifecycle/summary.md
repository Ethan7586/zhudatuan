# AU-452｜权益生命周期、财务投影与批处理

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821042000_benefit_lifecycle.sql`（316 行）。
- 人工审阅 finance/benefit 迁移逻辑、历史数据迁移、RLS、运行契约、事件、索引和断言；反查权益 API、权益消费适配器、任务注册、Worker 与死信。
- 本轮为静态审阅；未执行迁移、数据库对账、Worker、集成测试或线上查询。

## 真实运行关系

运营端的计划、预算、发放申请/审批/控制/撤销和权益 lot 查询进入 `BenefitOperations`；计划与批次版本、预算的预留/已发放金额、lot、lot movement、控制动作和到期提醒由该迁移持久化。发放审批会写入 `benefitgrant`，撤销复用同一任务类型的 `benefitrevoke` payload；定时/后台 `benefitexpiry` 激活到期前 lot、发送提醒并处理到期。

`BenefitJobProcessor` 对批次或 lot 加锁并分片处理，发放、撤销和到期均写复式财务分录、lot movement 与 outbox 事件。`app/jobs.ts` 为 `benefitgrant` 和 `benefitexpiry` 注册独立队列、并发、超时、重试、租约、死信和运行手册；死信处理回收未发放预算或标记撤销失败，并产生对应失败事件。

## 数据、财务与权限边界

- `finance.ensure_account` 为权益账户建立按 scope、代码和币种确定的总账账户；`finance.post` 以 `(scope_id, reference_type, reference_id)` 建立幂等的平衡分录，并拒绝关闭期间、同账户和不平衡写入。
- 计划和批次版本固定历史规则；预算新增 `reserved_minor`，批次在审批时预留、发放时转入 granted、取消/失败时释放。lot 和 movement 保留授予、消费、退款、到期、撤销的独立事实。
- 新增表启用 RLS：应用会话经计划或账户 scope 获得行权限，后台 job 身份处理异步工作；余额 view 使用 `security_invoker`，避免把查询者权限提升为 view owner。
- 迁移登记八个运营接口及其高/critical 权限、capability、默认 entitlement；到期、提醒、撤销和失败事件进入运行事件目录，索引覆盖范围查询、到期扫描和业务引用追溯。

## 高风险迁移边界

迁移先将旧 `benefit.entry` 投影到财务总账、回填 lot/movement，然后删除旧表，最终断言旧表不存在。这是历史财务数据切换而非垃圾代码；已登记为 **GX-0011**。未验证目标库逐 scope/币种的笔数和金额对账，且不存在可安全假设的直接回滚路径。

## 评审结论

- **G0**：计划、预算、lot、财务投影和发放/到期 Worker 由当前 API、作业注册、事件和持久化模型共同使用。
- **GX-0011**：旧权益流水迁移与退役必须专项、独立复核；禁止删除、改写、单独重放或与功能修复混合。
- 未发现本迁移新增且可直接证实的 P0–P3。核心未验证项为目标数据库迁移执行、历史对账和跨财务/权益端到端故障恢复。

## 后续验证与回滚边界

- 后续独立工作应从最新 `zdt-next` 新分支验证：计划版本变更、预算并发预留、四眼审批、批量发放/撤销、过期与提醒、死信恢复、财务 journal 与 lot movement 对账。
- 任何涉及此迁移的恢复必须采用已验证备份和按 scope/币种的差异核对；不得在审计分支执行迁移、清表或回滚。
