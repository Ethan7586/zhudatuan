# AU-648｜Enable L6 Storefront Self Registration

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260903112000_enable_l6_storefront_self_registration.sql`（187 行）。
- 审阅方式：逐段人工审阅 registration trigger 的 invitation/self-registration coalesce branch、transaction context binding、public storefront resolver contract；交叉检查 RegistrationOperations、MemberPort、Auth-web contract与定向 tests。未连接数据库或执行 registration。

## 审计结论

- **G0：保留，关联 F-0270。** migration 为 active Mall 增加无邀请码的 L6 Storefront registration path：candidate storefront membership 必须等于 transaction-bound resolved Mall，且仍必须有当前 registration challenge、active credential/profile和精确 role/scope projection。
- [FACT][E-AU-648-001] trigger优先使用已接受 invitation role；仅其为空时才允许 self-registration，后者要求 storefront client、active Mall、该 Mall canonical/independent role、candidate organization 与 `app.registration_mall_id` 精确一致。operator invitation branch不变。
- [FACT][E-AU-648-002] RegistrationOperations 先通过 storefront application slug 查询 authoritative organization/realm，验证一致后才设置 transaction-local `app.registration_mall_id`；IdentityRegistration tests覆盖 L1 self-registration 的 config、membership及 independent role projection。
- [FACT][E-AU-648-003] `identity.storefronts.read` 被明确发布为 public resolver，其 handler只返回已验证 storefront 的 terms/privacy/application/organization metadata；不要求 identity access context，供 Auth-web canonical registration预解析使用。
- **F-0270（P2，已登记）**：本文件明确使同一 existing consumer 可进入新的 Mall self-registration path，进一步确认多 Mall membership是支持的运行行为；qualification profile 的单 member key冲突因此不能视为不可达，沿用 F-0270 不重复计数。

## 未验证项

- 未用真实 DB RLS/trigger 验证 forged `app.registration_mall_id`、cross-realm application、expired challenge和同一 consumer第二 Mall self-registration。
- 未核验公开 resolver 的所有 deployed host/origin policy；仅确认 application contract与 API registration。

## 结论等级

- 新增问题：无；关联 P2 1 项（F-0270）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：沿用 F-0270；其数据模型验证必须包含无邀请码的 self-registration场景。
