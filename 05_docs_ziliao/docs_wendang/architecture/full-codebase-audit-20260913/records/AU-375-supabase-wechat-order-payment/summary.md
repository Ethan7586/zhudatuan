# AU-375｜Supabase 微信订单支付

`20260814130000_wechat_order_payment_compliance.sql` 建立了 Storefront 微信身份绑定、预支付、支付观察和初版 outbox 的数据库闭环。绑定必须消费一次性 challenge，并同时验证 active member、active Storefront membership 与 active context user；不会因支付回调自动绑定身份。预支付按商城、订单维度串行化，复用请求依赖 request hash 与 24 小时 idempotency record，且订单、会员、微信身份、商户号与金额均在同一数据库事务内核对。

运行入口已由 `commerce-api` 证实：已授权且已完成手机认证的订单用户从 Storefront 路由发起 prepay；支付平台通知先完成签名校验和解密，再写入观察；订单状态查询在需要时向平台查询并回写观察。观察记录拒绝 OpenID 明文证据，按 provider event key 去重，并交叉校验 app、商户、金额、付款人哈希和成功凭据；成功后只在受锁订单满足金额和状态条件时推进订单为 paid，否则进入对账路径。

初版 outbox 的领取、租约超时重试、指数退避及 12 次后死信逻辑在本迁移中均有实现；后续 `20260820124000_payment_outbox_consumer.sql` 已删除这两个初版 RPC，并以通用 payment outbox/inbox/effects 契约取代。当前仓库内的 SQL 契约测试覆盖后者的领取与消费语义；本次静态取证未找到该通用 outbox/effect consumer 的应用进程或定时注册。因此只将“生产消费进程实际部署及运行”标为未验证，不把文档或测试当作运行证明。

该迁移仍是现有微信支付 API 直接调用的身份、预支付、通知与查询 RPC 来源，归 G0。未发现新增 P0–P3 或删除候选；未执行支付、测试、数据库写入或线上检查。
