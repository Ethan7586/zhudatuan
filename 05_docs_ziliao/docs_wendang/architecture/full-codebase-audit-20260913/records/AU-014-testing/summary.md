# AU-014｜`@shop/testing` 测试基础设施

## 1. 边界

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；开工检查点CP-13 `7882a7a8`。
- 深入审阅20/20文件、403/403行：269行非测试源码、92行测试、42行package/tsconfig。
- 第一层仓外消费者只有Commerce repository contract测试对`DatabaseHarness`的一处import；browser subpath只被包内测试消费。
- 不安装依赖、不修复、不改源码/测试/配置、不连接测试数据库、不推送/合并/部署。

## 2. 结论

[FACT][E-AU-014-002/003] 该包是纯测试基础设施，无生产进程、发布单元或数据所有权。生产测试检查还会拒绝生产源码import `@shop/testing`，边界清晰。唯一当前包外使用是Repository真实数据库契约测试使用`DatabaseHarness`。

[CONFLICT][E-AU-014-004] `DatabaseHarness.run`在测试失败后执行reset；若reset也失败，finally异常覆盖原始测试异常。`ProviderHarness.execute`声明返回Promise，但matcher抛错时同步抛出。二者会让失败来源和断言方式失真，形成F-0068/P3。

[CONFLICT][E-AU-014-005] `HttpHarness`保存冻结快照，却把原始可变request传给异步responder。合成探针在send后改URL/header，记录仍是旧值，而responder读到新值，形成F-0069/P3。

[CONFLICT][E-AU-009-010] `TestIdGenerator`第18项被Kernel `Id.parse`拒绝；本AU确认包内无对应测试、固定仓库无调用者，补强F-0052/P3。

本AU新增P3 2项，补强P3 1项；新增G1 2项。累计P0 0、P1候选9、P2 37、P3 22、NIT 1；G0 2、G1 16、G2 1、G3 0、GX 1。

## 3. 值得保留与未知

- DatabaseHarness以finally保证主测试失败时仍清理，Repository consumer还对cleanup逐项容错，主路径合理。
- MSW默认未处理请求报错、Query默认关闭retry/refetch、Router使用memory router，均有助于测试确定性。
- HTTP已覆盖预取消、冻结header快照和typed error response；browser测试直接执行React/MSW/axe主干。
- [UNKNOWN] 仓外测试是否消费其余公共root/browser工具；因此零仓内调用只列G1，不能删除。
- 正式test/typecheck均因缺vitest/tsc在源码加载前退出127；未安装依赖。
