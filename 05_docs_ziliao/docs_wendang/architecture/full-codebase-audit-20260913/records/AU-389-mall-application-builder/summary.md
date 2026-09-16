# AU-389｜商城应用构建器

`20260818120000_mall_application_builder.sql` 建立每商城的不可变版本账本、draft/published 双头指针、乐观并发、按动作分域的幂等记录和审计事件。`save`、`publish`、`restore` 在同一事务中锁定 head；发布把 draft 复制为 published 并激活商城。初版粗粒度角色/范围校验已被后续 canonical scope 与 schema-v2 迁移替换，现行变体要求明确权限和授权证据，并校验受限组件配置。

固定基线中，数据库 schema-v2 契约测试直接覆盖 create/save/publish/restore、版本不可变性和发布可见性；迁移也以 service-role 授权公开中心、体验和变更 RPC。但未在 Commerce API、Console、Miniapp 或 Worker 源码发现这些 RPC 或底层表的直接调用。仓内 Commerce 的 experience/application 模型是另一套运行链，不能据此断言此数据库链可删除。

因此该构建器链记录为 DC-0056/G1：需在未来独立核验 Supabase 实例、服务端适配器及已发布客户端后，才可决定整合、正式下线或保留。未发现新增 P0–P3；未执行测试、数据库写入、构建或线上检查。
