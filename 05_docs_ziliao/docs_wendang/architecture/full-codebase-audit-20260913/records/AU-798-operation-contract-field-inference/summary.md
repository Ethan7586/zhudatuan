# AU-798｜Operation contract 字段推断器

- 审阅范围：`check/infer-operation-contract-fields.mjs` 与 OpenAPI/operations/Commerce AST/Vitest augmentation 输出。
- 审阅方式：深读 runtime write筛选、operation source定位、request/response AST field收集、Vitest failure augmentation及 `--apply` 写回路径；运行 `--summary` 只读模式。

## 审计结论

- **F-0311 / P3：** 79个 runtime关键写中只有66个发现 source，59个有request fields、35个有response fields；13个如 finance reconciliation、invoice、identity.wechat、member mall/sovereignty、order receive未映射到实现源。脚本仍成功退出，且`--apply`可把不完整结果写回 operations.yml，不能把推断结果当成完整契约证明。
- **DC-0088 / G1：** 未发现根 package/workflow 自动入口；仍保存将 AST/Vitest证据汇入 explicit operation contract 的人工工具职责，且有可观察输出和写入模式，不可删除。
- **安全边界：** 本审计未传 `--apply`/`--augment-vitest`，没有修改合同或读取测试报告。
