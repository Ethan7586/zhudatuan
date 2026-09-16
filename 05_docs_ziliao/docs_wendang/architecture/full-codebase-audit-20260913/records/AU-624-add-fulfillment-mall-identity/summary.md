# AU-624｜Fulfillment Mall Identity

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260901221000_add_fulfillment_mall_identity.sql`（206 行）。
- 审阅方式：逐段人工审阅 fulfillment order/line/milestone/return 的 mall、member、provider-scope 回填和中止条件、复合约束、运行 job scope 修正及 resource scope resolver；交叉检查 FulfillmentPort、FulfillmentJobs、订单读取、隔离契约与 Internal Mall 数据集导入路径。未连接数据库、执行迁移或运行种子工具。

## 审计结论

- **G0：保留。** 这是 fulfillment 与订单关系脱钩后仍能以 mall、member 和 provider scope 恢复追踪、退货、事件和授权范围的基础迁移。
- [FACT][E-AU-624-001] 回填链为 order → fulfillmentorder → line/milestone/return；任一 null、孤儿、订单/子单/售后跨 mall 冲突或重复关系会使整个事务失败，随后才设为 NOT NULL。
- [FACT][E-AU-624-002] child `(mall_id,fulfillment_id)` 复合外键，以及按 mall 调整的 provider reference/source effect 唯一键，防止不同 mall 重用同一业务标识时错误关联。
- [FACT][E-AU-624-003] 当前生产写入入口 FulfillmentPort 与 FulfillmentJobs 已携带 mall、member/provider snapshot 和 mall-qualified conflict/query 条件；`access.resource_scope` 改为直接读 fulfillment/return 的 mall，避免对 `ordering.orderrecord` 的反向依赖。
- [FACT][E-AU-624-004] `runtime.job` 的 fulfillment/tracking 任务 scope 被按 payload fulfillment 或 channel operation reference 回填；实现端后续 tracking enqueue 和 load 也以 mall 作为任务/查询边界。

## 新增问题

- **F-0265（P2）**：Internal Mall 数据集种子仍以旧列集合插入四张 fulfillment 表，迁移将这些新增列设为 NOT NULL 后，该正式本地数据集入口无法完成。详情见 `04-findings.md`。

## 未验证项

- 未在隔离数据库回放历史 fulfillment、跨 mall 关联或 job payload 的实际数据；未验证 migration report、索引建立时间和生产规模锁表影响。
- 未执行 Internal Mall 数据集导入，故 F-0265 记录为静态调用链与 schema 契约直接证据，实际命令失败回执未取得。

## 结论等级

- 新增问题：P2 1 项；无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：F-0265 需要在独立修复批次前以当前 schema 的隔离导入命令复核；迁移本身无需二次复核。
