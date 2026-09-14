# AU-721｜Owner、Registration 与 Sandbox Bootstrap 一次性流程

- 审阅范围：`04_tools/tools/seed/src/` 的 Owner、Registration、Staging Owner、Sandbox Catalog/Qualification/Welfare bootstrap 入口、计划、SQL 与测试，共 22 个文件。
- 审阅方式：深入审阅每类入口的环境/secret/database guard、serializable transaction、advisory lock、幂等和审计回执；同形 plan/test/fixture SQL 作结构性审阅。未执行任何 bootstrap 或 SQL。

## 运行关系

- Owner bootstrap 只接受固定 production loopback Postgres endpoint、`zhudatuanbootstrap` role、sentinel、明确确认词和 Secret Store 引用；其 DB function创建或复核唯一 platform owner，并带 audit record。
- Registration bootstrap 只接受 `APP_ENV=test` 与独立测试 DB；先安全建立一次性邀请导出，再在 serializable transaction 写 invitation/audit，并以 pending 文件原子提升保证重试一致。
- Staging Owner 与三类 Sandbox 都有各自 test/staging environment、confirmation、sentinel/plan 和固定资源 ID；SQL使用 idempotent insert/contract assertion，不能被长期 runtime role或 migration直接执行。

## 审计结论

- **G0：全部保留。** 这是唯一受控的初始化/验收/回执链，固定 ID、历史 baseline、测试 SQL 和 confirmation 不等于垃圾或可删除兼容代码。
- 无新增问题；未发现任一入口把 secret 明文写入 stdout，或绕过其 role/database/sentinel/confirmation guard 的直接仓内调用。
- 未运行定向测试或 bootstrap：真实入口会读取 secret 并写入数据库/导出文件，超出本审计分支授权。

## 未验证项

- 未验证生产/预发实际 role、sentinel、secret-store、数据库函数或导出目录权限。
- 不以本次静态审阅证明历史 bootstrap 已执行成功；执行回执和真实数据状态须在独立只读运行审计核验。
