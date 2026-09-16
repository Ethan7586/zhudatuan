# AU-003｜历史取证

历史只解释设计来源，不替代固定基线行为证据。

- [FACT] `mall-provisioning-isolation` 规则由 `fa4822ddb` 写入当前行；`git log -S` 把该规则追到 `caa1e57e` 所在演进链。当前基线中的实际行为仍以 planner 直接分类结果为准。
- [FACT] `JobRunner.delay` 的监听器实现由 `dd3eda9c` 引入并持续到固定基线；这只证明该实现的历史延续，不证明当前生产制品使用同一 SHA，也不证明线上已经发生内存故障。
- [FACT] `CatalogOperatorApiReadyMain.ts` 由 `b6c03e73` 建立，`ee0a6a1f` 后续增加 resource/scope 证据字段；两次都保持“独立创建 runtime 后关闭”的探针模型。
- [FACT] release engine 已用测试明确保存“迁移后 health/pointer 失败只恢复指针、数据库保持 applied”的 forward-only 契约；因此 F-0013 针对的是 migration body 与 ledger 的内部原子窗口，不把既定 forward-only 策略误写成偶发实现错误。
- [CONFLICT] staging `artifacts.yml` 声称 `FullJobsMain.ts` 没有独立制品并被 bundled 到 `JobsMain.js`，但 `build-commerce.mjs` 会分别发现两个 `*Main.ts`。staging unit 又被 `ExecCondition=/usr/bin/false` 固定阻断；本单元不据此认定任一入口可删除。

## 后续历史问题

1. `JobsEntrypoint.ts` 是否曾作为正式 bundle 入口，以及 profile dispatch 为何没有 payment runner，需要在 Jobs 专项结合旧发布记录复核。
2. 94 个冻结历史迁移为何没有显式事务、从何时改为 SQL 内 `BEGIN/COMMIT`，留给迁移逐批审计。
3. Catalog Ready 选择独立 runtime 而非 HTTP 探针是否有已记录的节点隔离约束，当前历史提交信息不足。
