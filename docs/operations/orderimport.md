# 外部订单导入运行手册

## 目标

`orderimport` 消费由 `order.imports.create` 建立的统一导入任务。每个 CSV 数据行代表一笔完整外部订单；任务按 500 行分片、最多四个工作器并发，单行使用独立事务。

## 模板字段

必填列为 `source`、`externalOrderNo`、`mall`、`member`、`orderedAt`、`state`。金额使用最小货币单位，`currency` 目前只能为 `CNY`。

商品可使用 `lines` JSON 数组承载多行；单商品订单也可直接使用 `sku`、`listing`、`title`、`quantity`、`unitMinor`、`discountMinor`、`product`、`productType`、`category`、`provider`、`partner` 列。`totalMinor` 必须等于全部商品应付金额之和。

声称已支付、已履约或已完成的订单必须提供 `paymentReference` 或 `statementReference`。系统只在已捕获支付流水或已平对账单中找到同范围、同币种、同金额证据时确认资金；否则订单进入“待核验”，禁止支付完成、履约、开票和结算。退款订单还需后续退款证据，导入时一律待核验。

## 幂等与排错

- 行幂等键为 `import + row`。
- 业务去重键为 `source + externalOrderNo`。
- 失败报告只记录行号、稳定错误码和安全摘要，不回显敏感原文。
- `ORDER_IMPORT_MAPPING_INVALID`：检查商城和会员映射是否处于当前管理范围且有效。
- `ORDER_IMPORT_AMOUNT_MISMATCH`：重新计算商品原价减优惠后的应付总额。
- `ORDER_IMPORT_DUPLICATE`：确认该渠道外部单号是否已被其他任务导入。

## 恢复

瞬时故障由运行时退避重试。永久格式错误会写入任务报告；修正源文件后创建新任务。不得直接修改订单金额或核验状态。
