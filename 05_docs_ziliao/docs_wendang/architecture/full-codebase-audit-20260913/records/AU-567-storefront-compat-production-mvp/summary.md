# AU-567｜Storefront Compatibility 基础生产 MVP 迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260724070000_production_mvp.sql`（812 行）。
- 审阅方式：逐段人工审阅 DDL、约束、RLS/授权、RPC、订单/内部支付事务及 seed；定向比对 Canonical 同名迁移、后续替换迁移和仓内调用/测试入口。未执行 Supabase、Postgres 或 migration replay（当前工作树未发现可用 `supabase`/`psql` 可执行程序）。

## 运行与数据边界

- 此文件建立 Compatibility Supabase 的历史基础 schema：租户、企业、商城、身份/角色、商品/库存、福利账本、购物车、订单/支付/退款/售后、审计与幂等表；全部表启用 RLS，直接 `anon`/`authenticated` 表访问被撤销。
- service_role RPC 是初始对外契约：公开目录、actor/bootstrapping、账户/订单读取、建单和内部余额支付。建单先按租户/商城和 active 商品计算金额，以条件更新保留库存；支付以订单和账户行锁、余额条件更新、账本/支付/订单更新、幂等记录与审计记录组成同一 SQL function transaction。
- 与 `02_platform_pingtai/database/supabase/migrations/20260724070000_production_mvp.sql` SHA-256 完全相同。这是两套隔离数据库共同的历史起点，不是 Compatibility 目录可删除的重复副本；AU-288 已确认两套 migration 不得混跑。
- 后续 Compatibility migrations 以 `create or replace` 修正内部支付，并引入 `api_create_order_authorized`、`api_pay_internal_authorized`；后者撤销 service_role 对原始 create/pay RPC 的执行权。因此本文件的初版直接 RPC 授权是 migration 历史，而非固定基线最终运行授权的充分描述。

## 审计结论

- **G0**：基础 schema、RLS 默认拒绝、初始数据、RPC signature 和后续演进的可重放历史均有真实迁移责任；不存在删除依据。
- [FACT][E-AU-567-001] 表和函数创建按 migration transaction 执行；建单/支付错误会使本 function 已完成的 DML 回滚，库存条件更新、余额条件更新和 idempotency conflict 各有明确拒绝路径。
- [FACT][E-AU-567-002] 初始函数只授予 `service_role`，而后续 member-assurance migration 已收紧为授权 wrapper 并显式撤销原始 create/pay execute；不得依据历史 grant 推断当前公开 API 权限。
- [FACT][E-AU-567-003] 固定基线内 Canonical 与 Compatibility 的同名迁移摘要完全一致；仓内 Compatibility test 目录目前覆盖后续会员/权限治理契约，未检索到对初版 `api_pay_internal` 的直接 contract 调用。

## 风险与未验证项

- 初版 `api_create_order` 的商品输入与内部支付 RPC 均是高影响写入路径，但固定基线的最终定义需要把全部后续 migration 按序 replay 后才能判定；本单元没有把历史初版差异误报为当前运行缺陷。
- 未验证真实 Compatibility 数据库的 migration ledger、remote PostgreSQL major version、所有后续 migration 的完整 replay、RPC privilege state、死锁/并发反事实以及仓外部署是否执行该数据库。无本地数据库工具，未做可能改变状态的重放。
- 后续应按单个 migration 继续审阅其对初始 schema/RPC/数据语义的覆盖，不得将初版 schema 或 seed 直接认定为生产数据来源或垃圾代码。
