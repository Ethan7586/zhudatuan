# AU-649｜Platform Owner L6 Registration

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260904010000_allow_platform_owner_l6_registration.sql`（225 行）。
- 审阅方式：逐段人工审阅 Owner 保护 trigger 的唯一放宽分支、L6 延后手机验证写入边界、migration ledger 前置/后置断言；交叉检查 Storefront registration 的 realm/Mall 解析、transaction-local context 写入及定向单元测试。未连接数据库或执行注册。

## 审计结论

- **G0：保留，关联 F-0270。** 此 migration 只允许受保护 Platform Owner 在已解析的 active Mall 中创建独立的 Storefront membership；原有 L0 Owner 身份、角色、授权、凭据和资料保护仍然存在。
- [FACT][E-AU-649-001] `access.protect_zhudatuan_owner` 的例外同时要求新增、`storefront` client、`new.organization_id` 与 transaction-local `app.registration_mall_id` 精确相同、且目标为 active Mall；不满足任何条件仍抛出 `ZHUDATUAN_OWNER_PROTECTED`。
- [FACT][E-AU-649-002] 写入保护函数仅接受 identity API session/role，L6 延后手机验证也只能在 Storefront client 和 `app.registration_phone_verification=checkout` context 下替代已消费 registration OTP；membership role 与 scope grant 仍须匹配该 membership、Mall 和 principal。
- [FACT][E-AU-649-003] HTTP 入口先解析公开 storefront application、核对 realm 对应 Mall 后才设置 `app.registration_mall_id`；定向单元测试覆盖 L6 password registration 设置 checkout context 且不消费 OTP。数据库 trigger 的伪造 context/跨 Mall 拒绝路径未实际运行验证。
- **F-0270（P2，已登记）**：允许 Platform Owner 取得新的 Mall Storefront membership 进一步证明同一 member 的多 Mall 身份属于运行路径；qualification 仅以 `member_id` 为主键的模型冲突仍沿用 F-0270，不重复计数。

## 未验证项

- 未在真实数据库验证非 identity API role、伪造 `app.registration_mall_id`、inactive Mall 和 Owner 第二 Mall 注册的 trigger 拒绝/允许矩阵。
- 未确认生产 registration migration runner 在含历史 ledger 的环境执行本 migration 时的完整顺序；代码层确认该文件会按原文作为 post-history migration 处理。

## 结论等级

- 新增问题：无；关联 P2 1 项（F-0270）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：沿用 F-0270；其数据模型验证应覆盖 Platform Owner 的 L6 Storefront registration。
