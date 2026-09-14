# AU-116｜Extension health 与 Channel 降级状态回写深审

`extensionhealth` 定期扫描 testing、enabled 与 degraded installation，并以 provider stage 结果写入 version-bound health evidence。enabled installation 失健康时，同一 transaction 将 Extension 及其 Channel connection 均转为 degraded；运行手册要求恢复端点或密钥后由 operator test/enable 完成显式原子替换，因此不自动恢复是设计边界。

未发现 P0/P1。health Worker 和状态机没有行为测试，记录为 F-0170/P2；未运行 Vitest。
