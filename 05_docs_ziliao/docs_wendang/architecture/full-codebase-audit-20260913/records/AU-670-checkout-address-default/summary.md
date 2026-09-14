# AU-670｜Checkout Address Default

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260909061000_add_checkout_address_default.sql`（56 行）。
- 审阅方式：逐段人工审阅默认地址回填、唯一索引与断言；反向检查 AddressPort 的 save/remove/set-default 并发控制和现有 unit tests。未执行数据库迁移或结算请求。

## 审计结论

- **G0：保留。** migration 将默认地址从推断行为提升为受数据库唯一索引保护的持久状态；每个拥有 active 地址的 member 恰有一个 default，删除地址后也能在事务内补选。
- [FACT][E-AU-670-001] 回填按稳定 `member_id,id` 顺序选择一个 active 地址；partial unique index 禁止同 member 同时存在两个 active default，断言同时检查“至多一个”和“至少一个”。
- [FACT][E-AU-670-002] AddressPort 所有会改变默认值的方法先取得 member advisory lock；save/set-default 先清除旧 default 再写 target，remove 在删掉 default 后补选 remaining active address，避免应用并发路径违反数据库约束。
- [FACT][E-AU-670-003] unit tests 覆盖 lock、expected version 不匹配不清除现有 default、以及默认切换的查询顺序；结算/下单只按 active address id 读取，未依赖非确定性的列表首项。

## 未验证项

- 未复放存在多条 historical active address 的迁移数据，未知实际被选作默认地址的业务偏好是否与 `id` 排序一致。
- 未在真实数据库并发执行 save/remove/set-default；静态分析确认应用锁和 partial unique index，未验证隔离级别和失败回滚。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（address default 数据回填与唯一性约束）；不新增 G1/G2/G3/GX。
- 二次复核：否。
