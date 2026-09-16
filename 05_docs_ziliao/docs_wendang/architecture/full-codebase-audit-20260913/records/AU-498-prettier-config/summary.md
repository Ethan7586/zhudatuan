# AU-498｜Prettier 主配置深审

- 审阅对象：根 `.prettierrc.json`（8 行）。
- 方法：人工审阅全部配置；静态追溯 package 格式化入口、依赖版本、`.editorconfig`/`.gitattributes` 与 `.prettierignore`。未执行格式化。

## 结论

- **G0**：正式 `format`/`check:format` 入口会自动解析该配置。single quote、semicolon、ES5 trailing comma、2 空格、240 列及 LF 与仓库级 EditorConfig/Git 属性相容。
- 240 列是明确的可读性取舍，不是可从静态审计推断为错误；其对 SQL/TSX/文档的实际格式效果未运行验证。
- 未发现 P0–P3，也没有删除候选。
