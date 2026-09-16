# AU-534｜Payment provider time evidence PGlite 测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/PaymentProviderTime.test.ts`（207 行）；关联 AU-490 的 provider time migration 结论。
- 审阅方式：逐段人工阅读；PGlite test 未执行。

## 审计结论

- **G0 / GX-0021 补强**：测试确认 migration 为历史 payment facts 的 provider evidence 添加字段而不伪造历史时间；新 capture/refund/observation 需要可验证 JSON effect/hash，exact replay 可行，sealed fact 禁止修改/删除，partial/mismatch/invalid time fail-closed。是财务时间证据与不可变性规格，禁止删除。
- 此 test 使用极小 base schema 和 PGlite，只验证 migration 局部约束；不代表真实 payment provider webhook、数据库 role/RLS 或全部 schema 的运行行为。

## 未验证项

- 未运行 PGlite；真实 PostgreSQL JSON canonicalization、migration replay/order、provider payload signature与生产历史数据未验证。
