# AU-082｜Pricing Rule→报价金额独立复核

本批不重述 AU-081 的模块结论，而是从消费者全集和报价数值输出逆向复核 F-0159。

`pricing.rule` 的 Commerce 源码消费者只有 QuoteReader 的 published-rule 查询；`kind`、`condition`、`effect` 原样成为 quote evidence。报价计算则直接以有效 `pricing.price.amount_minor` 生成 line total，并只把 marketing campaign 作为 discount 来源。没有规则解释器、条件匹配器或将 rule effect 应用到金额的实现。

契约仍把两个管理 operation 标记为 console/operator、critical，并允许开放对象请求体；对应 Pricing 测试仅断言 manifest。需求映射将商城加价与价格规则接到该 operation。因此 F-0159 确认为 P1：管理端发布规则会形成持久/审计证据，但不会影响报价或结算金额。

未发现 P0；未执行测试、未安装依赖、未修改生产代码或线上状态。
