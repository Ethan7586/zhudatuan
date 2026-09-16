# AU-591｜筑大团 Web Business 数据访问边界

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260828173000_zhudatuan_web_business_access.sql`（552 行）。
- 审阅方式：逐段人工审阅专用角色、session-bound RLS helper、benefit balance、表/函数授权、sandbox catalog bootstrap、RLS policy 和最终断言；交叉检查 WebBusiness runtime、实际 scope resolver、Aliyun registration 初始化与迁移静态契约测试。未连接数据库或运行迁移。

## 审计结论

- **G0：保留。** 此迁移是 Web Business API 从宽泛 `shopapp` 权限隔离到专用 `zhudatuanwebapi` 的历史访问边界，且定义 sandbox catalog 的单次受限 seed 权限；它承担 session、成员、商城、购物车、地址、福利余额、审计和数据库角色的唯一迁移责任，不能删除。
- [FACT][E-AU-591-001] 两个专用角色均要求 `NOINHERIT`、非超级、非 CREATEROLE、非 BYPASSRLS；真实 Aliyun 初始化脚本为二者预配独立 LOGIN/password，迁移本身不存储凭据。
- [FACT][E-AU-591-002] `access.web_member_scope`、`access.web_storefront_scope` 与 `benefit.web_account_balance` 都只接受 `session_user='zhudatuanwebapi'`，同时验证 session/membership 配对、未撤销与未过期、credential/access version、principal/profile/membership active；storefront helper 进一步限制客户端和 active mall。Commerce 的 `WebBusinessScopeResolver` 与 `WebBenefitOperations` 实际调用这三个函数。
- [FACT][E-AU-591-003] Web API 可写范围只有 idempotency、cart、cart item、address、decision audit 及 audit 记录；迁移断言显式拒绝 order/payment/finance/runtime job/outbox 写入和 finance/payment schema usage。福利余额通过 security-definer function 返回，不给 Web API 直接 finance ledger 权限。
- [FACT][E-AU-591-004] sandbox bootstrap 必须满足独立注册数据库 sentinel 且 session user 为 `zhudatuansandboxbootstrap`；对 catalog、pricing、inventory、experience 和 audit 的 RLS insert 逐行固定到 sandbox 对象值，禁止更新、删除和 finance/payment/order/benefit schema access。
- [FACT][E-AU-591-005] 当前 `WebBusinessApiRuntime` 已以 `zhudatuanwebapi` 为必需 `current_user/session_user`，检查双参数 `identity.resolve_session(text,text)` 及后续 schema head；本迁移内的单参数会话 grant 是随后正式 migration 替代的阶段性数据库契约。
- [FACT][E-AU-591-006] runtime 创建时把数据库兼容性失败记录为 warning 后继续启动，已由 **F-0249** 单独登记为 P1 候选；本单元不重复新增 finding，亦不能以该已有风险推导本 migration 已经在生产失效。

## 未验证项

- 未验证真实 RDS 角色属性、RLS 启用状态、database URL 是否对应专用 login、session GUC 是否只由受控 request transaction 设置，或 sandbox sentinel 是否已经封存。
- 未运行 seed、RLS deny case、购物车/地址写入、福利余额查询或启动兼容性检查；对历史 migration 的实际执行时序和遗留数据状态未知。

## 结论等级

- 新增问题：无；既有相关项：F-0249（P1 候选）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；若专项处理 F-0249，必须在隔离环境检查实际 DB role、schema version、RLS allow/deny 与启动失败行为。
