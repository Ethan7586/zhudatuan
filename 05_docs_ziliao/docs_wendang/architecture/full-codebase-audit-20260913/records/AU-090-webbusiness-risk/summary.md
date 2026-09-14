# AU-090｜WebBusiness 风险门禁适配器深审

WebBusiness runtime 将 `WebRiskCheckAdapter` 绑定为 AccessPipeline 的 `RISK_GATE`。每次授权在 read-only transaction 中设置 API database context，读取 membership ancestor scopes、active policy/baseline rollout、近 24 小时 signal、block list 与 access decision velocity，使用 canonical RiskEngine 并选择最严重 outcome。

风险 RLS 把 policy/signal/list 绑定到 web actor 与 scope；适配器的设计不写风险域事件、runtime outbox 或 job。调用方若读取异常会收到异常，现有测试明确覆盖这种失败传播，因此风险门禁维持上层 fail-closed 语义。

未见 P0–P3；未运行 Vitest、未改变任何生产状态。
