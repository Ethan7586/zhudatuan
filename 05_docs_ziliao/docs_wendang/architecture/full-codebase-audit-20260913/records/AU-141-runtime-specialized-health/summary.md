# AU-141｜Runtime 专用健康探针与 API 装配深审

Runtime 提供一个共享 API host probe 和五个专用 profile probe。共享 dependency probe 同时读取 queue/deadletter、cache、query metrics 与 compatibility，并在 audit transaction 中记录访问；Purchase、Web Business、Identity Registration、Mall Provisioning profile 则仅允许 liveness/readiness/startup 并调用各自 bootstrap compatibility；Catalog Operator profile 已在前序 Catalog entry 链审阅。

新增 F-0175/P2：现有 `RuntimeOperations.test` 只验证共享 dependency SQL 的 aggregate FILTER 语法，manifest test 只核对 module identity；没有针对四个未审专用 profile operation 的 ready/blocked、live evidence 或未知 operation 分支的行为测试。未发现 P0/P1；未运行测试（审计 worktree 缺少 Vitest）。
