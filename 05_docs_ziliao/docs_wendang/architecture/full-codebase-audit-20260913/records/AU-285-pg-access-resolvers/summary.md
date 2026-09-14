# AU-285｜PostgreSQL 访问解析器深审

本单元实现会话、成员快照、访问版本、数据范围和能力解算。会话解析先要求服务器绑定的 request node，再按 token 哈希和 host 调用 `identity.resolve_session`，验证 account/realm、membership client/governance organization 与入口 realm；成员、版本和能力解算都要求同一 membership consumption context；scope 解析将数据库结果重新绑定到 actor node context。各 API runtime 将同一组解析器接入 `AccessPipeline`，Catalog/Purchase 的 scope 包装器再追加各自边界。

205 行 fixture 覆盖 node/realm 连续性、旧会话投影拒绝、L0/L1 cookie 隔离、缺失 account/realm 失败关闭、数据库决策时间以及成员快照。原 F-0036 的 `member.read` 写操作问题由上游 Operation 权限声明造成；本单元按声明解算能力，未发现新增 P0–P3。审计工作树缺少 Vitest 依赖，未运行测试。
