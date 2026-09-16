# AU-413｜微信支付查询结果确认

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260820127800_wechat_payment_query_result.sql`。
- 交叉核对：查询队列、观察落账核心、查询契约测试和 Commerce 微信支付路由。
- 本批为静态调用链与迁移语义审阅；未执行数据库重放、构建或线上操作。

## 运行结论

查询结果入口首先复核领取租约和提供商侧身份/金额，再调用观察核心；拒绝的证据以不可重试失败关闭租约，合法结果根据付款状态调度下一次查询或临近库存到期时请求关单。关单被接受后也在有效租约下回写，并在短延迟后再次查询确认最终状态。两个入口只授予 service role。

固定基线中没有找到这两个 canonical 结果 RPC 的仓内作业调用。Commerce 微信支付路由直接调用旧 `api_apply_wechat_payment_query`，而恢复队列使用 `access.purchase_enqueue_payment_query`；是否有仓外 service-role 作业或生产切换无法从静态仓内证据确认。

## 审计结论

- DC-0065 / G1：不得删除；应先核验生产查询/关单工作者、RPC 调用日志、旧入口切换状态和微信对账恢复路径。
- 本批未新增 P0、P1、P2 或 P3；未运行验证均已明确保留为未验证状态。
