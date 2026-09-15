# RV-0069｜供应商业务模拟数据脚本独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；仅静态审阅，未连接数据库或执行任何写入。
- 对象：`04_tools/scripts/data/seed-supplier-business-simulation.sql`（257 行）与配对 `cleanup-supplier-business-simulation.sql`（17 行），对应 DC-0090 / GX-0049。

## 独立入口与调用链

- 固定仓库内未发现根脚本、workflow、发布配置或运行注册器调用两份 SQL；其唯一可确认入口是经 `psql` 等工具的显式人工执行。零自动引用不构成删除证据。
- seed 和 cleanup 都以 `ON_ERROR_STOP` 与单一事务运行。二者按相同 `supplier-business-v1` 命名空间，从 reporting/finance/channel 到订单子表和订单主表逆序清理；seed 先清理旧批次，再构造临时订单池并写入订单、订单行、售后、渠道、结算、对账及报表事实。
- seed 的末尾断言要求总订单行数为 1000、主供应商/蛋糕供应商分别为 600/400，且低价商品数为 10；异常会阻止提交。cleanup 在提交后查询剩余模拟订单数，构成现有唯一的恢复操作。

## 结论

- **GX 维持，不得删除或执行。** 这不是运行时自动任务，而是一套跨订单、财务、渠道和报表边界的受控业务演示数据职责。脚本依赖当前 Mall、供应商、published listing、partner 与实际 schema；误连数据库、schema 漂移或人工执行错误仍可能产生数据影响。
- 静态证据确认了命名空间、事务、断言及配对 cleanup 的存在；未验证真实 schema 兼容性、目标库安全互锁、执行回执、cleanup 后行数和财务/供应商演示所有者责任。
- 后续只能在独立专项中，由数据、财务和供应商演示 Owner 在隔离环境以授权方式确认人工入口、数据库保护、演练回执与恢复结果；不得从本审计分支执行、改写或删除脚本。
