# AU-585｜Storefront Compatibility 服务端购物车迁移

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260725090000_server_cart.sql`（65 行）。
- 审阅方式：逐行人工审阅 read/upsert/delete scope、SKU validation、UPSERT/audit 和 service-role grants；定向核对现行 Commerce API cart routes及后续 qualified snapshot/write RPC。未执行 cart RPC。

## 审计结论

- **G0**：该迁移仍包含实际生产调用的删除 RPC，并保留购物车数据边界的历史契约，不能删除。
- [FACT][E-AU-585-001] 初版 read/upsert 都按 tenant/mall/user scope，upsert 限 active SKU/product 与 1–99 数量，cart 与 item 使用唯一键 UPSERT；write/delete 分别记录 audit fact，所有 RPC只授予 service_role。
- [FACT][E-AU-585-002] 当前 `cartRoutes.ts` 的 GET/PUT 已调用 later `api_cart_snapshot_qualified` / `api_upsert_cart_item_qualified`，但 DELETE 仍实际调用本文件的 `api_delete_cart_item`；该 function 通过 cart 所属 tenant/mall/user约束目标 item，客户端不提交 cart owner。
- [FACT][E-AU-585-003] later qualification/checkout/inventory migrations演进 read/write snapshot 与库存资格，但没有证明删除 RPC已撤销或替换；无仓内 caller的初版 read/upsert仍有 migration/external compatibility责任，不能单凭调用迁移标记删除。
- Compatibility 与 Canonical 同名 migration SHA-256 一致，仍不可混跑。

## 未验证项

- 未执行跨 user/mall delete、并发 upsert、inactive SKU、audit insertion失败或 checkout 的实际 inventory snapshot反事实；F-0193 已记录 PUT/delete缺 direct fixture的测试缺口。
- 未验证 enterprise 参数与 cart schema的关系、service-role credentials/RLS、Compatibility远端最终 qualified function state或仓外旧 read/write consumers。
