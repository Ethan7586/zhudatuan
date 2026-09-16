# AU-602｜Owner 运行时边界加固

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260829212000_owner_runtime_boundary_hardening.sql`（447 行）。
- 审阅方式：逐段人工审阅 predecessor/future/data guard、active password uniqueness、pending successor snapshot trigger、invoker owner guard、job retention/import security-definer functions、shopjob revoke/RLS 与最终断言；交叉检查 Owner transfer、registration migration plan、seed/verify 与成员导入调用面。未连接数据库或运行 migration/job/import。

## 审计结论

- **G0：保留。** 该 migration 把 Owner transfer 的 pending successor 从仅 membership/version 指针提升为不可变身份快照，限制 job role 的身份/访问权限，并保护 Owner/候选人免受导入和清理路径间接变更；不能删除。
- [FACT][E-AU-602-001] migration 只接受独立 registration DB 的已知 predecessor、拒绝 future head，并在 `ownertransfer` 非空时 fail closed，禁止猜测/回填历史 pending transfer。每 principal 只允许一个 active password credential。
- [FACT][E-AU-602-002] pending transfer insert 会锁定 target membership/profile/principal/password credential，快照 member/principal/credential/version/subject HMAC/mobile token；更新禁止 snapshot 改写，accept 时再次验证完整 identity 与 access version。
- [FACT][E-AU-602-003] `access.protect_zhudatuan_owner` 保持 invoker trigger：直接 runtime DML 对 active Owner 或 pending successor 一律拒绝，只有 migration/superuser 和已校验 security-definer 路径可写。`zhudatuan_protected_identity` 只返回保护身份的布尔判断，且最小授权给 app/job/identity API。
- [FACT][E-AU-602-004] shopjob 被撤销 identity/access 权威表的全部直接 CRUD 与 challenge write，只保留 member profile 的 `id/status` 列读取；过期 challenge/session 清理和 import principal/profile/membership 通过输入受限、scope/workload 检验、advisory lock、protected identity 拒绝的 definer functions 执行。
- [FACT][E-AU-602-005] final assert 同时验证 snapshot trigger/六个非空列、invoker guard、partial unique index、security-definer setting、shopjob 全部 direct privilege/policy deny 与 narrow function execute，形成明确的运行隔离契约。

## 未验证项

- 未执行 pending transfer snapshot、credential rotation、accept identity drift、job purge/import、RLS deny 或真实 job role；线上是否存在历史非空 transfer、过期 session 或导入队列未知。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；未来修改 job/import/owner transfer 时，应在隔离 PostgreSQL 覆盖 pending snapshot、credential更新、protected identity、direct job DML deny、purge retention 和导入 collision/rollback。
