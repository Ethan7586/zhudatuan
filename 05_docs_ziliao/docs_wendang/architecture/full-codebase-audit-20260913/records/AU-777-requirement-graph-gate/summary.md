# AU-777｜Requirement graph 静态门禁

- 审阅范围：`04_tools/scripts/audit/requirements.mjs` 及 `check:requirementgraph` entry。
- 审阅方式：深入审阅 workbook authority、requirements/mapping/MVP/provider/frontend documents、operation/module/test/evidence path、status/release evidence、sensitive projection 和 report boundary。
- 验证：未运行；需要 requirementgen/TS workspace resolution。结论基于规则及正式入口。

## 审计结论

- **G0：保留。** `check:requirementgraph` 是 architecture gate，验证导出工作簿哈希/行号/ID、94 类需求、21 个 MVP、20 家 provider、前端 trace、operation ownership、路径存在性和 release-evidence 状态。
- **边界：** 只验证声明和文件存在/静态一致性，不运行 contract/journey/unit test，也不证明 HTTP、数据库、provider 或发布行为；不能把通过结果当作需求实际验收。
