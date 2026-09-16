# RV-0043｜微信支付应用场景隔离独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0021
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：重新审阅迁移、支付创建/网关/回调链；未访问支付记录、微信凭据或外部渠道。

## 迁移责任

迁移为 payment attempt 加入 `miniapp`/`jsapi` 场景和不可变 AppID 的 SHA-256；非终态尝试必须同时拥有二者，并建立 application hash、intent、请求时间索引。它不保存 AppID 明文，持久化地将渠道订单归属到正确应用场景。

## 当前运行关系

Payment gateway 将 scene/application hash 作为应用上下文用于下单、查询和关闭。Webhook 先以已验签事件中的 application hash 定位 scope，再读取最近微信尝试并同时比较金额、币种、付款人、scene、application hash；任一不一致抛出 `PAYMENT_WEBHOOK_INTEGRITY_MISMATCH`。支付 public contract 也将 application hash 作为 intent 上下文。

## 裁决与未知项

维持 GX。已静态确认创建、网关调用、回调定位和完整性校验依赖此持久化绑定；未验证 Miniapp/JSAPI 真实分流、历史终态、渠道凭据、重试、回滚或恢复。后续变更须从届时最新主线建立独立支付/渠道/数据库专项；本审计分支未调用支付渠道。
