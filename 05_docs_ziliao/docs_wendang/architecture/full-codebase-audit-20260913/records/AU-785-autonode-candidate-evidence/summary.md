# AU-785｜AutoNode 候选节点证据生成器

- 审阅范围：`check/autonode-candidate.mjs` 与 `provisioning/autonode-engine.mjs` 的候选根保护边界。
- 审阅方式：深读输入、artifact provenance、三节点隔离、并发幂等、回滚隔离和 evidence 输出；反查 package/workflow/release 的仓内调用。
- 验证限制：**未执行。** 该命令会在 `--output` 或临时目录创建 candidate root、artifact、ledger、receipt、node runtime plan 和 evidence；审计分支只允许写审计报告，不能以验证为由产生运行候选制品。

## 审计结论

- **G1：疑似闲置，证据不足，禁止删除。** 没有发现根 package script、GitHub workflow 或发布 manifest 的自动启动入口；治理台账亦将其列为“无根自动入口”的人工隔离预览工具。
- **保留责任：** 该脚本证明同一 immutable Console artifact 可生成三个独立 realm/data-scope/node manifest、端口不冲突、五次并发 replay 收敛、对中间节点回滚不改变首尾节点，并将外部资源状态固定为 `WAITING_EXTERNAL`。它是候选 provisioning 的唯一高层隔离验收说明之一。
- **风险：** supplied output root 是完整文件 authority；只应在临时/受控目录运行，且输出不能被当作生产发布证据。
