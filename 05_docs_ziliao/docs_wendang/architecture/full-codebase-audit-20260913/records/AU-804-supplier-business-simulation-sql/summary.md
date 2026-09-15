# AU-804｜供应商业务模拟 SQL

- 审阅范围：`seed-supplier-business-simulation.sql`（257 行）及配对 `cleanup...sql`（17 行）。
- 审阅方式：逐段审阅事务、清理条件、订单/行/售后/渠道/财务/报表写入和末尾断言；未连接数据库、未执行脚本。

## 审计结论

- 两脚本均启用 `ON_ERROR_STOP` 并在单事务内运行。seed 开始以前缀/精确 ID清除前一批，cleanup使用相同条件和子表先行的顺序；报表只删除`dimensions.simulation=supplier-business-v1`，其余表均使用固定 simulation ID/前缀。
- seed 明确生成1000条临时订单、关联的行/售后/渠道/结算/对账/statement及报表事实，并以数量断言收口；它依赖当前 Mall、供应商、已发布 listing、partner 和目标 schema，缺少时会回滚而不完成。
- 无根脚本、workflow或生产注册入口；但这是一套成对可恢复的人工业务演示数据职责，定为 **GX**（高风险，禁止删除）。不执行写入，不能证明实际schema兼容性或cleanup后的真实行数。
