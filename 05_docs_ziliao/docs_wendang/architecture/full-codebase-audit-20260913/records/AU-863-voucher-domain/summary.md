# AU-863｜卡券领域模型审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`voucher/Domain.md`，1 个文件、898 行。
- 方法：审阅事实所有权、目标聚合、不变量、状态机、一致性边界、事件和财务事实；对数据库模型只核对代表性表/演进迁移及当前 reversal 实现，避免与 AU-862 重复审查架构目录。

## 结论

文档的核心模型坚持 Voucher 只拥有卡券事实、Partner/Approval/Finance 保留各自事实所有权、同库关键写入事务化、查询/通知/报表最终一致，以及 Finance 通过幂等事实而非反向领域依赖入账。这与当前 Voucher schema、`programversion`/import/card/allocation 演进迁移及 module manifest 的模块边界相容。

聚合名称（如 `VoucherProduct`、`StockRequest`、`IssueOrder`、`ActionBatch`）是目标 B2B 模型，不等同于当前 `program`、`reserverequest`、`issuebatch` 等运行表的已完成替换。初始迁移中的 `reversal` 形态也不能单独证明当前不支持部分退款：当前 `VoucherPort` 已按累计 reversal 金额检查并写入 reference。

没有新增 finding。该文件归 G1：它是将来实现/迁移必须遵守的领域规格，当前无运行、构建、部署或迁移入口直接消费；不得依据目标实体名删除或重命名现行数据结构。领域状态机和现行 contract 的完整逐操作对账留给 `Flows`、`Delivery` 和 `Operations` 的独立单元。

未执行测试、构建、部署、数据库迁移或外部控制面操作，未修改业务代码、配置、测试、工作流、迁移或运行资源。
