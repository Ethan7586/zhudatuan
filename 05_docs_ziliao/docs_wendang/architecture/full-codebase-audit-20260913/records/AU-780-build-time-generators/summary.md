# AU-780｜构建期配置生成器

- 审阅范围：`build-miniapp-environment.mjs`、`build-miniapp-theme.mjs`、`build-runtime-config.mjs`、`build-web-tokens.mjs`。
- 审阅方式：深读四个生成器的来源、校验、输出和 `--check` 分支；反查根 `package.json` 的 `generate:design`、`generate:runtime`、`generate:clients`，以及 `check/generated.mjs` 的正式一致性入口。相同的“来源→确定性文本→check/write”骨架按结构性覆盖处理。
- 验证：四个脚本的只读 `--check` 均退出成功；未运行写入式生成命令，工作区未由本审计改写。

## 审计结论

- **G0：全部保留。** 这是设计、MiniApp 和运行配置的正式生成链，而非孤立辅助脚本。Web token 从 `tokens.json`/`mobile-platforms.json` 生成 CSS/TypeScript；MiniApp theme 同步 token 与品牌资源；environment 从共享 schema 生成配置校验器；runtime 从平台 YAML 生成运行容量和缓存目录。
- **边界：** `--check` 仅验证生成物与当前输入完全相等，不能证明 token 的所有消费者都使用了有效变量，也不验证配置值在实际部署环境中的合理性。既有消费者闭合和设计漂移结论保留在 F-0075、F-0076、F-0081；本批未新增问题。
- **风险控制：** 生成器没有原子多文件提交；若中途写入失败可能留下部分更新的生成物。当前正式 check 可发现漂移，但不能自动恢复。该风险为低概率构建期维护风险，未达到新增独立 finding 门槛。
