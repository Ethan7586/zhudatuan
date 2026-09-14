# AU-628｜Mall Provisioning Access

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902012000_zhudatuan_mall_provisioning_access.sql`（152 行）。
- 审阅方式：逐段人工审阅 provisioning database role、ACL、RLS、assertion 与运行入口；交叉检查 MigrationRunner 的排序/变换规则、MallProvisioningApiRuntime、专用 entrypoint 和三个 creation ports。未连接数据库、执行迁移或启动服务。

## 审计结论

- **G0：保留，但存在 P2 迁移可执行性缺陷。** 此 migration 定义 non-login/non-inherit/non-bypass-RLS 专用 role，并按 Mall 创建需要授予 runtime、组织、目录、体验、风险和审计的最小读写面，显式排除 identity/order/payment/finance 域。
- [FACT][E-AU-628-001] role 建立与 assertion 同时检查 superuser、create role/database、inherit、replication、bypass RLS 与角色成员关系；应用 runtime 启动时重新核对 exact role、schema marker、selected writes 与 forbidden domains。
- [FACT][E-AU-628-002] MallProvisioningApiMain 只装载 provisioning/runtime selected modules；entrypoint test 对路由白名单和三条 mall creation port closure 有明确断言。
- **F-0266（P2）**：本 migration 在第 38-40 行 `grant execute` 两个 `access.provision_mall_owner` / `access.read_provisioned_mall` 函数，但仓内首次定义在按字典序更后的 `20260903103000_provision_l1_mall_owner.sql`。MigrationRunner 对所有 migration 文件排序后原样执行，故新数据库会在本 migration 中止。

## 未验证项

- 未在空 PostgreSQL 运行全量 migration；F-0266 以排序执行器、原样 SQL、唯一首次定义位置组成直接静态证据，尚无实际失败回执。
- 未以真实 provisioning role 调用 API；未验证 runtime role 的外部凭据配置。

## 结论等级

- 新增问题：P2 1 项（F-0266）。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：F-0266 需要；复核者应在干净隔离数据库仅运行至 `20260902012000`，确认失败位置和既有部署的已应用 ledger。
