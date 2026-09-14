# AU-483｜平台 Owner Cockpit 商品与库存读取

- 主审 `20260821076000_grant_platform_cockpit_reads.sql`（51 行），并人工反查 Console Cockpit 路由/预取、catalog/inventory operation 目录和 AccessPipeline capability gate；未执行迁移、构建、服务或线上查询。
- 迁移只移除 `catalog.listing.read`、`inventory.read` 的同项 deny 并向平台 Owner 增加 allow；迁移断言该 membership 实际获得 `catalog.listings.read` 与 `inventory.availability.read`。没有授权 publication、stock adjustment 或其他 catalog mutation。
- Console 把 Cockpit 作为默认主入口，依据 session access version 和 scope 发起预取；AccessPipeline 先以 capability 阻断未授权 operation。商品/库存 handler 仍各自执行资源范围与读取模型约束，role grant 不会直接写入业务表。
- **G0**：两个 read permission 是默认 Cockpit 的 API 进入条件。**GX-0039**：平台 Cockpit 商品/库存高权限只读授权，禁止删除、改写、跳过或单独重放；需独立复核 current role permission、跨 scope 读取、Console UI 的能力隐藏与审计。未发现新增 P0–P3；未验证真实 Console 页面、数据库 RLS 或生产 capability 集。
