# AU-118｜Channel 远程下单/退款类型契约深审

Channel 的 public 与 application 两层仅再导出 `@shop/contract` 的 `RemoteOrderSubmitter`、`RemoteRefundProvider`。真实实现来自 provider core PortFactory，履约与支付通过 extension registry 获取。

未见仓内直接消费者，但这些是稳定 module public API 的类型入口，外部编译消费者未验证，归类 G0。未发现 P0–P3。
