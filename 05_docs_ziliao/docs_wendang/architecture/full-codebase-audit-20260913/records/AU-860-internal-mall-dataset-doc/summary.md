# AU-860｜Internal Mall 测试数据集说明审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`testdata/InternalMallDataset.md`，1 个文件、115 行。
- 方法：深入审阅全部命令、隔离约束、数据处理声明和验收边界；与 dataset seed/import/verify/cleanup 运行入口、AU-720 生命周期结论及既有 finding 交叉核验。未执行会连接或写入数据库的命令。

## 结论

该文件是 `local:dataset:*` 与 `dataset:import:test` 的人工操作契约，保留本地合成数据标识、事务、Mock、幂等、清理和验收边界，归为 G0，不能因其不是源码而删除。

本地 seed 说明与实际 local-only guard 的意图一致；但“标记测试数据导入”部分宣称目标须为规范测试库且不会污染既有记录，实际 import parser 会跳过数据库前缀、localhost 与非 ITHT 业务行检查。该文档与实现的安全边界漂移已由 `F-0293`（P2，高置信）完整覆盖，本单元不重复登记。

文末也明确 API 200、页面渲染和浏览器金额核平尚未验收；其历史“已执行”叙述不能替代当前基线的可复跑运行证据。

未执行测试、构建、seed、import、cleanup、部署或外部控制面操作，未修改业务代码、配置、测试、工作流、迁移或运行资源。
