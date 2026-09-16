# AU-640｜Invitation Record Target And Creator Scope

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903102000_invitation_record_target_and_creator_scope.sql`（71 行）。
- 审阅方式：逐段人工审阅 schema/backfill/FK、identity API select policy delta 和前置/lock；交叉核对 invitation consume write、registration profile token semantics 与后续 governance-parent migration。未连接数据库或执行 migration。

## 审计结论

- **G0：保留。** migration 为 operator invitation history 增加掩码目标和 accepted operator membership reference，并收紧 non-owner invitation record visibility 至“创建者本人或被邀请接受者”。
- [FACT][E-AU-640-001] `destination_masked` 和 deferred FK `accepted_membership_id` 均只保存展示/关联数据，不保存 token/hash；backfill 只处理 operator invitation，并对 accepted candidate 按 active status、joined time、ID 取得稳定首选 membership。
- [FACT][E-AU-640-002] backfill 的 `allowed_destination_hash=profile.mobile_token` 与 registration flow 对齐：operator registration 建立 account 使用 KMS fingerprint，但 `member.profile` 写入的是 `subjectHash`；invitation create/consume 同样使用该 HMAC `destinationHash`，因此 profile join 的 key 语义一致。
- [FACT][E-AU-640-003] 新 RLS policy 保留匿名 registration 读取和 AU-639 Owner subtree branch；对 authenticated non-owner operator invitation record，要求 `created_by` 或 `accepted_membership_id` 等于 current membership。后续 AU-644 以该 accepted membership 建立 governance parent tree，调用关系已可追踪。

## 未验证项

- 未在真实 PostgreSQL 验证 deferred FK、历史重复手机号/多 membership 的 backfill 选择和 RLS 的 creator/acceptor/owner allow-deny 矩阵。
- 未确认历史库中可回填行的数量；无匹配行时字段保持 null，迁移没有将其视为错误。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：不需要；若清理历史 invitation 记录，须先输出 null accepted target 的数据统计并由数据所有者确认。
