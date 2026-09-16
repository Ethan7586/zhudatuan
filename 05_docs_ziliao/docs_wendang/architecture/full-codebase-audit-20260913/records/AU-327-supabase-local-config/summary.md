# AU-327｜Supabase 本地运行配置

`database/supabase/config.toml` 是本地 Supabase CLI 项目配置：API、数据库、Studio、realtime、storage、edge runtime 和 analytics 使用本地端口；迁移和 `seed.sql` 在本地 reset 时启用。新 public 对象默认不自动暴露，配置中的密钥位置均为环境变量占位；`.gitignore` 排除本地分支、临时文件与 dotenvx 本地密钥文件。

该文件描述的是本地开发容器，不是 GitHub/阿里云生产部署入口；未发现仓内证据表明其 local Auth 开关、速率默认值或 `site_url` 被生产认证链直接采用，故均标记为本地运行参数而非线上事实。未启动本地容器、未运行 reset 或迁移，避免改变数据库状态。

未发现新增 P0–P3 问题或删除候选；两文件均为 G0（本地运行与凭据排除配置）。
