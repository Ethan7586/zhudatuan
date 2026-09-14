# AU-678｜Order Participant / Product Route Snapshot

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911113000_order_participant_product_route_snapshot.sql`（54 行）。
- 审阅方式：结构性审阅。核对新增 order/line/suborder/aftersale snapshot 字段与索引；反向检查 PlaceOrder 的 snapshot 写入、Web order/payment/aftersale 消费和 supplier contract fixtures。未重复深读已审订单/供应链业务状态机，未执行迁移。

## 审计结论

- **G0：保留。** migration 为订单参与者、产品供应路由、合同和结算方建立不可随当前配置漂移的订单时点事实；字段均为 additive 且不回写历史订单。
- [FACT][E-AU-678-001] `ordering.line` 保存 route/contract/party 结构化列与 JSON snapshot，`orderrecord` 保存交易/关联/参与者快照，suborder/aftersale 保存后续履约与售后需要的路由事实；三个索引对应 transaction、participant、route/supplier 查询。
- [FACT][E-AU-678-002] PlaceOrder 在下单时按解析的 supply route 构建带 schema version、transaction/correlation、operating/participant、supplier/contract/party/effective time 的 route snapshot，并在同一写入中持久化 line 字段和 route steps。
- [FACT][E-AU-678-003] Web order、支付售后与 supplier fixtures 读取已保存 route snapshot，而非重新推导当前供应配置，符合历史订单可审计性。

## 未验证项

- 未在多条 route version/合同变更的真实订单数据上验证 snapshot 对账。
- 未验证已有历史 order 的新增 nullable 字段如何在旧 API 响应中呈现。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（order participant/product route historical snapshot schema）；不新增 G1/G2/G3/GX。
- 二次复核：否。
