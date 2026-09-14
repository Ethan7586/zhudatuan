# AU-449｜结算至订单的原子提交边界

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821039000_checkout_atomic_order.sql`（177 行）。
- 交叉核对：Purchase/Order/Checkout/Payment 运行操作、后续支付/退款迁移及数据库契约序列。
- 本批为静态迁移语义和调用关系审阅；未执行数据库重放、下单、支付、退款或线上操作。

## 运行结论

迁移将报价依赖与签名、结算输入和全类型证据、订单地址/发票/履约快照和行级折扣/应付额纳入订单创建边界。它撤销独立 `checkout.quote.confirm` operation，避免同一结算被两条确认路径处理；订单创建由当前 Purchase 操作承接。

支付侧建立 intent/refund tender 的顺序、唯一、引用、状态和 RLS 约束，允许订单零金额但不允许各 tender 为零；售后退款与唯一 aftersale 绑定。迁移也以 capability audience 统一 member scope 解析，并登记 invoice profile read。

## 审计结论

- G0：订单创建与支付/退款计划模型的关键迁移边界，不是删除候选。
- 多 tender 资金守恒、报价签名、库存预留与数据库事务原子性由后续运行链共同保证；本批未执行端到端或并发验证。
- 本批未新增 P0–P3。
