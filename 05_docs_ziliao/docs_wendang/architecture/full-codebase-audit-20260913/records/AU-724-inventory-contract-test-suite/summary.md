# AU-724｜Inventory 与 Checkout 数据库合同测试套件

- 审阅范围：atomic checkout/inventory、Mall identity、payment expiry、reservation lifecycle 与 single-source cutover 5 份 SQL contract。
- 审阅方式：深入审阅 transaction rollback、身份/授权证据、库存 reservation/ledger 幂等、Mall composite key和人工 cutover/step-up断言；未运行 SQL。

## 审计结论

- **G0：全部保留。** 5 份合同分别覆盖 checkout 原子写入、Mall 隔离、payment expiry、reserve/commit/release/return/oversell 和 legacy inventory cutover；不是重复的 SQL smoke files。
- 每份均以 transaction 包裹、动态 UUID/suffix 造数和 `rollback` 清理；关键非法路径明确期待业务错误或 FK violation，而不是只验证成功路径。
- 无新增问题。当前测试执行器与 migration head 兼容性未验证；相关 seed 写入兼容风险仍以 F-0265 单独追踪。
