# AU-431｜履约与核验初始模型

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821020000_create_fulfillment_verification.sql`。
- 交叉核对：后续回填、对账、索引和范围解析迁移，以及 Commerce 履约 worker、退货、库存回补和核验操作。
- 本批为静态迁移语义与调用关系审阅；未执行数据库重放、构建、测试或线上操作。

## 运行结论

履约域以 `source_effect_id + suborder_id` 与供应商外部单号约束承载去重，按履约单、履约行、里程碑和退货记录保存供应商执行链。后续迁移/运行代码扩展商城、成员和供应商范围字段；履约 worker 与操作接口持续写入状态、外部单号和里程碑，库存回补读取退货和履约行。

核验域以 session、nonce、受信设备与 attempt 记录发放、消费、防重放和追踪。nonce 与 attempt 都以 session+hash 为唯一键，后续授权解析从 session/device 反查 scope，索引迁移提供过期回收和审计查询路径。

## 审计结论

- G0：履约幂等、状态里程碑、退货和核验防重放的基础关系模型，不是删除候选。
- 初始迁移与后续字段扩展共同形成当前 schema；不得仅因初始列与当前运行 SQL 不同而认定该文件失效。
- 本批未执行数据库重放、供应商回调或 nonce 并发消费验证；这些行为保持未验证。
- 本批未新增 P0–P3。
