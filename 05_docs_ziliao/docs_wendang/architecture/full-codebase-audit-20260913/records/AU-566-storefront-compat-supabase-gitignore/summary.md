# AU-566｜Storefront compatibility Supabase 本地状态忽略规则

- 审阅范围：`02_platform_pingtai/database/storefront-compatibility/supabase/.gitignore`（8 行）；定向核对目录内容和 Git ignore 匹配。
- 审阅方式：规则与 repository-relative fixture/migration tree人工核对；未运行 Supabase 或数据库命令。

## 审计结论

- **G0**：`.branches` 和 `.temp` 被 Git 精确忽略，适用于 Supabase 本地 branch/temp runtime state；`.env.keys`、`.env.local`、`.env.*.local` 阻止 dotenvx 密钥和本地环境覆盖被纳入版本控制。
- `git check-ignore --no-index` 确认 `.branches/example` 与 `.temp/example` 匹配当前文件规则；tracked migration、tests与 `config.toml` 不在忽略范围，保留兼容 schema/replay契约。
- 本文件不加载运行配置，也不能证明兼容数据库是否应当部署；其职责是本地工作目录和凭据卫生，不构成删除依据。

## 未验证项

- 未验证本机是否存在未跟踪 dotenv/Supabase state、其他路径的 secrets、compatibility migration真实 replay或外部 Supabase CLI默认目录行为。
