# AU-495｜本地状态与凭据排除规则深审

- 审阅对象：仓库根 `.gitignore`（47 行）。
- 方法：人工审阅全部 pattern 与注释；静态追溯 localinfra、开发/Compose 脚本、发布临时目录、检查/发布引擎和工作区状态。未生成本地凭据、未运行发布或清理。

## 结论

- **G0**：不是垃圾。它排除依赖/构建/测试产物、所有本地 env（仅保留示例）、TLS/data、worker secrets、Codex 临时预览、AI delivery state、支付证书和历史并行工作树，直接保护凭据与基线可复现性。
- `local:*`、`dev:*` 与 localinfra 确实写入并读取被忽略的 `.env.local`/`secrets.local.json`/TLS/data；发布 workflow 也生成 `.oss-release`，但该目录为 runner 临时制品，当前规则不显式忽略它，未在本地工作树观察到残留。
- 当前审计分支仅存在此前列明的五份独立复核队列脏文件；没有发现本次审计夹带的生产文件。未发现新增 P0–P3；实际个人配置、支付证书或 CI 临时目录的历史提交未核验。
