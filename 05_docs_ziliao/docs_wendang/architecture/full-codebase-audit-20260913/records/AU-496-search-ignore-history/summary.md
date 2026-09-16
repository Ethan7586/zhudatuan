# AU-496｜检索历史目录排除规则深审

- 审阅对象：仓库根 `.ignore`（1 行）。
- 方法：人工审阅全部 pattern；静态核对 ripgrep 的 ignore 语义、README、Vitest exclude 与 workspace audit。未创建历史目录或运行全量检索/测试。

## 结论

- **G0**：`.ignore` 由 ripgrep 等兼容工具自动消费，预先排除 `06_history_lishi/`，避免可选旧主线/归档进入日常代码检索。
- 当前固定审计 worktree 中该目录不存在；README、Vitest 和 workspace audit 仍明确把它定义为不参与构建/测试的历史边界。因此该规则是“目录存在时的防误检”契约，不是失效文件。
- `.gitignore` 负责 Git 状态，`.ignore` 负责开发/审计检索，职责不同。外部历史归档是否仍保留及实际开发者工具配置未验证。未发现 P0–P3。
