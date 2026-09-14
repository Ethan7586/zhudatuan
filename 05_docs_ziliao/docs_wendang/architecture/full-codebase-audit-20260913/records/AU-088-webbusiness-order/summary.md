# AU-088｜WebBusiness Order 聚合读取运行入口深审

WebBusiness 只注册 `order.orders.read`。主查询按 owner、supplier、store 或 organization closure 限定 orderrecord，并为行、经济 legs、库存 reservation、fulfillment、payment/refund、finance journal/entry、aftersale 及操作历史构建 JSON 聚合；payment/fulfillment/lifecycle/period/view 过滤和 cursor 都由白名单解析。

主订单、line 与 aftersale 有 `zhudatuanwebapi` RLS policy。但 order projection 同时读取 payment/finance 表；202609111535 只新增 schema/table select grant，payment/finance 建表已启用 RLS，而本审计未发现适用于该 role 的 policy。因此相关 lateral join 在实际 web role 下将默认看不到行，记录 F-0161/P2。测试只模拟 SQL，不能验证 role/RLS。

未发现 P0；未运行 Vitest、未改变数据库或服务状态。
