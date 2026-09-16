# AU-294｜Compatibility 微信订单支付闭环

该 1,034 行 migration 形成微信身份绑定、JSAPI prepay、回调/主动查询观察、订单状态应用与 outbox 投递的单一链。身份绑定消费十分钟一次性 challenge，禁止自动按 UnionID 绑定；prepay 以订单级 advisory lock、尝试唯一约束和 24 小时 idempotency key 串行化；通知/查询验证 app、mch、金额、付款人 hash、交易号和成功证据后才变更支付与订单，观察记录不可变、outbox event key 去重。

Compatibility API 的 prepay 必须有会员授权和 idempotency key；公网通知先签名校验/解密后才调用 RPC，付款人明文只在运行内使用，测试确认摘要不含 OpenID。支付查询只在 `needsQuery` 时触发，outbox 用 `skip locked`、两分钟租约回收、指数退避和第 12 次 dead letter。未发现 P0–P3 新问题；未连接真实微信/数据库，迁移回放和供应商验签仅有静态与 fixture 证据。
