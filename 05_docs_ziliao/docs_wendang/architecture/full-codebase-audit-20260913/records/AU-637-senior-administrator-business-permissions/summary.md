# AU-637｜Senior Administrator Business Permissions

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902140000_align_senior_administrator_business_permissions.sql`（164 行）。
- 审阅方式：对三处同构 `approved_codes` 清单作一次语义核对，人工审阅前置、advisory lock、allow/deny mutation 与双向 assertion；交叉核对 AU-631 Senior role 的 owner-only 排除集。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** 本 migration 把明确批准的业务 permission 从 platform Owner baseline 投影给各 tenant 的 Senior Administrator role，并同时保持 owner-only governance permission 不可泄漏。
- [FACT][E-AU-637-001] migration 以 AU-636 exact checksum 为前置、持有 transaction-scoped advisory lock，并先断言每个 active tenant 均已有 Senior Administrator role、所有 approved code 均在 Owner allow baseline 中。
- [FACT][E-AU-637-002] 写入逻辑仅删除 approved code 的 Senior deny、再从 Owner allow mapping 插入缺失 allow；不会创建不在 Owner allow baseline 的新 permission。
- [FACT][E-AU-637-003] 末尾 assertion 双向检查：Owner 的非 owner-only allow 必须全投影，Senior 不得拥有 `access.ownership.*`、role/scope/capability 管理或 registration reset，且 Senior allow 不能超出 Owner allow。该排除集与 AU-631 的治理边界一致。

## 未验证项

- 未在隔离数据库对多 tenant、Owner baseline 缺项、Senior deny 冲突与 owner-only leak 执行反事实 migration。
- 调用层对每项被授予业务 permission 的 operation scope/资源 ownership 属于各业务模块专项，未在本权限对齐文件重复审阅。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；实际变更 Owner/Senior permission catalog 时需权限所有者复核 approved list。
