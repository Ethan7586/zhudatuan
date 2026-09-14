# AU-288｜Storefront Compatibility 数据库运行边界

`02_platform_pingtai/database/storefront-compatibility/supabase` 是 Storefront/Auth → `commerce-api` 相容链路的独立 Supabase 测试数据库，而非 Canonical Commerce 数据库的重复构建产物。根 README、SOURCE-MANIFEST、制品配置和部署输入拒绝规则一致表明：两套 migration 不得混跑；Compatibility runtime 不可作为筑大团候选制品，但这不等于该数据库目录没有运行或历史兼容责任。

本单元含 63 个受版本顺序约束的 migration/test/config 文件。`config.toml` 开启 migration 与 seed、指定 Postgres 17，API 只暴露 public/graphql_public。各 migration 尚未逐文件深审，保留“暂未审阅”状态；本轮只建立真实部署和数据所有权边界，未认定任何文件为 G1–G3。无 P0–P3 新问题。
