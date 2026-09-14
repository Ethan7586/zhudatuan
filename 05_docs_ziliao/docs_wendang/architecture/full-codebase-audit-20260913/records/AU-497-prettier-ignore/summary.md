# AU-497｜Prettier 格式化排除规则深审

- 审阅对象：根 `.prettierignore`（22 行）。
- 方法：人工审阅全部 pattern；静态核对正式 `format`/`check:format` 入口与列出的生成/迁移路径。未执行格式化。

## 结论

- **G0**：`npm run format` 与 `npm run check:format` 自动消费该文件；它排除依赖、构建/报告产物、锁文件、迁移、byte-preserved handoff、Miniapp generated data、图标/令牌与设计 token 等不应被通用格式化改写的对象。
- `supabase/migrations/` 与 `drizzle/` 保留迁移文本稳定性，generated Miniapp 数据和样式 token 保留生成器权威；没有证据支持把这些排除项当作垃圾。
- 个别 handoff 文件当前是否仍在基线、所有 excluded token 的生成来源及格式化后回归未验证。未发现 P0–P3。
