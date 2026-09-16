# AU-768｜Identity Realm 隔离验证

- 审阅范围：`identity-realm-isolation.mjs` 及 `test:identity-realms`/database-contracts dispatch。
- 审阅方式：深入审阅 canonical node manifest comparison、L0–L11 fixture、realm/target/profile constraints、session/ticket/login-intent、cross-host/password/logout/membership deny/credential-version isolation 和 transaction rollback。
- 验证：未运行。正式入口依赖 AU-764 的 PGlite/replay chain，当前工作树无法解析 `pg`；无迁移或线上连接发生。

## 审计结论

- **G0：保留。** `test:identity-realms` 通过 database-contracts 的 `--identity-realm-isolation` mode 调用。fixture 在单一 transaction 建立 12 个 realm，断言 canonical manifest、consumer/admin target限制、ticket 一次消费、跨 realm/host session 拒绝、密码与 logout 范围、deny override 和 credential-version session invalidation，最后 rollback。
- **边界：** 验证的 session/login intent 都是数据库 fixture，不启动真实 HTTP、Cookie/CSRF、KMS、短信或外部身份提供商；PGlite/replay 不等于生产 realm 数据、DNS/host routing 与在线会话状态。
