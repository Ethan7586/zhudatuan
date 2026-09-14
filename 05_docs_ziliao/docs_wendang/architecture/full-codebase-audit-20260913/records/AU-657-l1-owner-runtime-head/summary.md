# AU-657｜Complete L1 Owner Runtime Head

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260906011000_complete_l1_owner_runtime_head.sql`（94 行）。
- 审阅方式：结构性审阅。该文件不引入新业务逻辑或新运行入口，仅将 AU-656 的 L1 Owner role、权限集合、Mall scope assignment、scope name projection 和前序 ledger 作为 runtime head 断言；已对比 AU-656 原始写入和同一 checksum 链。

## 审计结论

- **G0：保留。** migration 将 L1 Owner 的完整状态固定为可验证 database checkpoint：权限集合必须与 Platform Owner 的非 ownership allow 集合精确相等，active Mall Owner 必须存在同 Mall 的有效 role assignment。
- [FACT][E-AU-657-001] assertion 使用双向 `EXCEPT`，不仅检查 L1 Owner 漏授权限，也检查额外权限；该约束与 AU-656 的 role copy 及 ownership exclusion 完全对应。
- [FACT][E-AU-657-002] 本文件不定义/替换 function、不授予 ACL、不写 membership/role/grant business data；唯一持久写入是其自身 `runtime.schemaversion` marker。
- [FACT][E-AU-657-003] predecessor 要求 AU-654 checksum 且无 future head，防止在未知 migration state 上把 L1 Owner assertion 当作有效 runtime checkpoint。

## 未验证项

- 未执行数据库，未验证历史数据在本 checkpoint 的实际通过率。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（runtime consistency checkpoint）。
- 二次复核：否。
