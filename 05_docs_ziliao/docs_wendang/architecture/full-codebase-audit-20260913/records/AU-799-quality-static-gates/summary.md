# AU-799｜供应链、测试结构、事务边界静态门禁

- 审阅范围：`check/supplychain.mjs`（65 行）、`check/tests.mjs`（101 行）和 `check/transactions.mjs`（72 行），以及它们的根脚本、直接被检运行入口和既有 finding。
- 审阅方式：三个正式只读 Node 入口分别运行；按用户授权的同构文件规则，对每个 checker 审核入口、断言集合、输出和与实际代码的差异，不把静态通过误写为行为验证。

## 审计结论

- **F-0259 / P2（复现，未重复登记）：** `check:supplychain` 退出 1，仍报告 7 个 lockfile license finding，secret finding 为 0；正式 hard-cut 因此不能完整通过。
- **F-0312 / P2：** 事务门禁把 `new ModuleOperations(... purchasePaymentAction(...))` 的启动期 handler 装配报作执行期外部调用（输出位置 116，真实 RiskGate/DecisionSink 调用在 returned action 的 157-160）；同时对身份 `identity.stepup.start` 的 execute 内 KMS 调用只按方法名报警。它提供了值得人工复核的信号，但无法精确证明或否证真实事务边界。
- **F-0313 / P2：** `check:tests` 输出通过、声称 `clients=6`，但只对三个 Web app 检查“有任意 test 文件 + 任一 test script”；Miniapp 只验 `app.js` 存在，未运行这些测试，也未证明文件覆盖路由/行为。该门禁是测试拓扑索引，不能作为测试行为健康证明。
- 三个脚本均由根 package 直接注册并串入质量门，均为 **G0**，不进入删除候选。

## 验证边界

- 已运行：`node 04_tools/scripts/check/{supplychain,tests,transactions}.mjs`；结果分别为 exit 1、0、1。
- 未运行：全量 hard-cut、业务测试、数据库、KMS、支付网关或任何写入模式；因此没有把 KMS/风险依赖的网络行为、超时、锁持有时长或回滚写成事实。
