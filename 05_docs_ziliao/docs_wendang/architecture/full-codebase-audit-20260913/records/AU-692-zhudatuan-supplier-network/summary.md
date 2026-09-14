# AU-692｜主打团供应网络

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260912120000_create_zhudatuan_supplier_network.sql`（259 行）。
- 审阅方式：种子商品、SKU、价格、库存和映射记录按同构数据写入作结构性审阅；深入核对供应方/协议归属、控制台调用入口、数据库会话 scope、security-definer 汇总函数、RLS/ACL 和可执行测试。

## 审计结论

- **G0：保留。** migration 建立主打团与 Cakeuncle 供应方、有效协议、产品 owner、可售 trial catalog、价格/库存/source listing 以及控制台供应网络投影；这些数据分别被 Catalog、Quote、Order 和供应链控制台能力消费，不能按重复种子或零直接文件 import 判定为垃圾。
- [FACT][E-AU-692-001] Console 的供应链预取在具有 `catalog.listings.read` capability 时，以 `view=supply-network` 请求 Catalog；Catalog/Web Catalog action 从认证 access 取当前 `scope.id`，调用 `catalog.console_supply_network($1)`，而非将 scope 作为浏览器请求参数直接透传。
- [FACT][E-AU-692-002] API transaction 设定 `app.scope_id`、membership、actor 与 workload；普通 relation 的 RLS 以 `access.scope_allowed` 约束当前会话 scope。
- **F-0282：P2。** `catalog.console_supply_network(p_scope)` 是执行给两个 API role 的 `security definer` 函数，并明确 `row_security=off`；其所有 supplier、agreement、price、inventory、reservation、source 读取只以调用参数 `p_scope` 过滤，未以 `access.scope_allowed(p_scope)` 或当前 session scope 再次拒绝。故 scope 授权完全依赖两个应用 action 的当前实现，真实 PostgreSQL role/RLS contract 未覆盖允许 scope、错 scope 与直接 function invocation 的矩阵。

## 未验证项

- 未连接生产 PostgreSQL，不能确认 function owner、`BYPASSRLS` role attribute、连接池 role switch 或生产 policy catalog；结论限定为仓内 migration/运行代码事实。
- 未调用外部 Cakeuncle 或主打团供货系统；source listing 的同步 freshness、实际协议履约和生产库存准确性未验证。
- 定向正式入口 `npm run test --workspace @shop/commerce -- src/modules/catalog/06_tests_ceshi/SupplierNetworkMigration.test.ts` 于 2026-09-15 未启动（worktree 中 `vitest: command not found`，exit 127）；按审计边界未安装依赖或修复测试环境。该失败不改变对测试内容的静态结论，也不能作为迁移通过的运行证据。

## 结论等级

- 新增问题：F-0282（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 项（供应方、协议、catalog/inventory seed 与受控 projection）；不新增 G1/G2/G3/GX。
- 二次复核：是；复核者需以真实 `zhudatuanidentityapi`/`zhudatuanwebapi` session 分别验证允许 scope、越权 scope、无 capability 与直接 function execute，并独立确认最小授权设计。
