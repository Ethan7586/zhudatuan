# AU-115｜Channel provider-operation 端口与履约/退款调用链深审

`ChannelOperationPort` 是 provider order 与 refund 的公共幂等记录端口。履约 Worker 在提交 provider order 后，在同一事务更新 fulfillment、记录 operation 并投递 tracking；支付退款 Worker 在 provider attempt/observation 生命周期中记录并更新 WeChat refund operation。

唯一键配合 request hash 旨在区分安全重放与不同请求，但冲突 SQL 返回零行时 `record` 未检查结果，调用者会继续。该问题记录为 F-0169/P2。未发现 P0/P1；未运行 Vitest。
