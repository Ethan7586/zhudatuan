# AU-435｜报告、风控与审计初始模型

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821024000_create_reporting_risk_audit.sql`。
- 交叉核对：后续索引、Web/Console 数据库访问边界，以及 Commerce 的报告投影、风控策略和审计查询/写入链。
- 本批为静态迁移语义与调用关系审阅；未执行数据库重放、构建、测试、归档或线上操作。

## 运行结论

报告域建立受版本控制的指标定义、时间维度 fact、异步导出、订单投影和财务投影。后续仓储以投影水位和版本处理事件重放，以 export 状态推进文件生成，后续访问策略向 Web/Console 限定 scope。

风控域以 policy/policyversion、replay、signal、decision、case 和 listentry 保存策略运行和人工处置；运行适配器按 active/baseline 版本读取策略与信号。审计域以时间分区 `audit.record`、访问记录和归档引用保存 trace、前后哈希与链式哈希字段；渠道、财务等模块实际写入/读取它。

## 审计结论

- G0：报告投影、风控决策、不可变审计记录和归档索引的基础关系模型，不是删除候选。
- 当前表列、RLS 与角色权限由后续迁移扩展；本批只确认创建语义和静态调用链，未验证运行时哈希链完整性或导出/归档恢复。
- 本批未新增 P0–P3。
