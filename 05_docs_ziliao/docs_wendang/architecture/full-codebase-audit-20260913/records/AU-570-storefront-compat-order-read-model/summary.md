# AU-570｜Storefront Compatibility 旧用户订单读模型

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260724101500_order_read_model.sql`（63 行）。
- 审阅方式：逐行人工审阅 `api_order_views` scope、JSON shape、payment allocation 和 item snapshot；定向核对现行 Commerce API route、后续 scoped/detail RPC 与 Canonical 同名迁移。未执行数据库查询。

## 审计结论

- **文件 G0；函数 G1（DC-0071）**：迁移本身保留完整的 Compatibility schema replay 历史，不能删除。其 `api_order_views` 仍是 service_role 公共 RPC，但固定基线没有应用调用；当前用户/管理订单路由使用 later `api_order_views_scoped`，故旧函数进入保守的疑似闲置候选，而不是删除候选。
- [FACT][E-AU-570-001] 旧函数精确按 tenant/enterprise/mall/user 过滤，返回订单金额、福利/餐补 payment allocation 汇总与 product snapshot；不写数据，未向 anon/authenticated 授权。
- [FACT][E-AU-570-002] `commerce-api/src/api/orderRoutes.ts` 和 `adminRoutes.ts` 调用 `api_order_views_scoped`；该 later function 支持 `p_user_id = null` 的管理范围。`api_order_views` 在固定基线除 migration 定义外无仓内调用。
- [FACT][E-AU-570-003] Compatibility 与 Canonical 同名 migration SHA-256 一致；两数据库各自的 replay/外部 caller 均未排除，不能从 application 无命中推断可删。

## 未验证项

- 未读取真实 Compatibility PostgreSQL 的 `pg_proc`/privilege/dependency，未验证仓外 service_role consumer、历史制品或直连数据库报表。
- 未验证旧 JSON response 与 `api_order_views_scoped`、later `api_order_detail_by_no` 的外部契约兼容性，以及跨 scope/tenant 的实际 RLS/authorization execution。
