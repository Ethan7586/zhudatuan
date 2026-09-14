# AU-484｜Reporting Cockpit 跨域读取模型

- 主审 `20260821077000_add_reporting_cockpit.sql`（76 行），并人工反查 GetDashboard、PgReportingRepository、Console Cockpit query、RLS/grant 和后续 supplier/period overload；未执行迁移、数据库查询、构建或线上验证。
- 迁移把 listing、inventory、ordering 和 reporting fact 汇总收敛为 Reporting 所有的 `reporting.cockpit(scope)` 函数：目录/库存/订单/售后计数、销售退款净额、趋势与类目份额均以给定 scope 的组织子树或 reporting facts 计算。函数为 `SECURITY INVOKER`，撤销 public execute，仅授予 shopapp/shopjob。
- handler 链为 AccessPipeline 派生 scope → GetDashboard → ReportingRepository；Console 以当前 session scope/accessVersion 请求 `reporting.dashboard.read`。后续三参 supplier/period function 在没有 supplier 视图时回退到此一参函数，因此它仍是当前 Cockpit 结果链的一环。
- **G0**：该函数是跨域业务数据不被浏览器自行拼接的受控汇总边界。**GX-0040**：跨域经营指标与 RLS-sensitive reporting function，禁止删除、改写、跳过或单独重放；需独立复核 invoker RLS、跨 scope/tenant 反事实、时区与金额精度、fact watermark 和 fallback 结果。未发现新增 P0–P3；未验证实际 reporting fact 完整性、current function body 或线上 Cockpit 数据。
