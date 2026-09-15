# AU-790｜SFL PostgreSQL 17 隔离验收 fixtures

- 审阅范围：administrator segment scope、execution contract kernel、hosted mall opening、hosted node provisioning、member registration progression、multi-realm membership、node context scope、sovereign upgrade 八个 `sfl-*.pg17-fixture.mjs`。
- 审阅方式：深读 node-context-scope 与 sovereign-upgrade 的 Docker/SQL/role/concurrency/cleanup 链；逐项结构核对其余同构 fixture 的 PG17 container、migration/test 输入、rollback/concurrency assertion 和根 package 入口。
- 验证限制：**未执行。** 任一 fixture均会启动 Docker PostgreSQL 17、写入临时数据库、执行 migration/contract SQL及并发业务调用，超过审计分支“仅写审计制品”边界。

## 审计结论

- **G0：全部保留。** 这些不是无用脚本，而是 SFL 层级/主权/realm/context/registration/mall/upgrade 数据合同的受控集成验收：使用随机容器、随机密码、loopback 临时端口，并在 finally 删除容器。
- **正式入口：** 八个 fixture均有根 `package.json` 的 `check:sfl-*` 入口；sovereign upgrade还串联 AutoNode engine tests。
- **验证边界：** fixture成功只能证明其指定 migration/test SQL 和临时容器行为；不能直接证明生产数据库、真实资源分配或线上域名/发布状态。相反，不能因本批未执行就将其降为闲置或删除候选。
