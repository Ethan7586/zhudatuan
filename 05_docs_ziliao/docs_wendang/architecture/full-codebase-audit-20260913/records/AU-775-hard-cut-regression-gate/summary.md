# AU-775｜Hard-cut regression gate

- 审阅范围：`04_tools/scripts/audit/regression.mjs`。
- 审阅方式：深入审阅退役目录、辅助目录、route/env token、production path/behavior regex 与 root quality gate。

## 审计结论

- **G0：保留。** `check:regression` 和 `audit:architecture` 正式接入；若退休目录、旧路径/env 或 production source 的 compat/demo/fallback/fixture/legacy/mock/simulation 语义再次出现即 fail-closed。
- **边界：** 规则依赖目录名和文本 token，不能证明无动态注册、仓外服务、运行期 feature flag 或真实 traffic；也不能单独作为删除候选证据。
