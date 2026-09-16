# AU-888｜260821 权威需求工作簿审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`福利商城功能清单260821.xlsx`，1 个 XLSX、约 205 KB、9 张工作表。
- 方法：只读核对 SHA-256、OpenXML 工作表结构、authorities 配置、authority loader、requirement generator、WorkbookReader 与 graph gate 输入；未输出工作簿业务单元格、接口元数据或潜在敏感内容。

## 结论

文件 SHA-256 为 `78cfc3…`，与 `authorities.yml`、`mapping.json`、requirements/MVP/providers/frontend 生成物和 `RequirementCatalog.generated.ts` 的权威链一致。Authority loader 约束仓内相对路径、realpath、散列、父目录穿越与仓外符号链接；RequirementGenerator 通过 fflate/WorkbookReader 解压 OpenXML，读取 shared strings 和指定工作表/单元格生成 296 条需求、21 个 MVP 和 20 个 Provider；`check:requirementgraph` 再验证哈希、数量、ID、路径与契约映射。

该工作簿是当前 G0 权威输入，不能删除、替换、编辑、复制敏感单元格或以通用表格库的样式兼容性失败降级。任何改变应由受控 authority/generator 批次处理，并重新验证派生物和需求图。

未运行 generator、quality gate、测试、构建、部署、数据库或外部控制面操作，未修改工作簿、代码、配置、测试、工作流、迁移或运行资源。
