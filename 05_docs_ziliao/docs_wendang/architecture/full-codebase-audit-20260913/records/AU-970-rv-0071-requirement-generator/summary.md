# RV-0071｜RequirementGen 合同生成器独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；仅静态审阅，未运行生成器、未安装依赖、未写入输出。
- 对象：`04_tools/tools/requirementgen/src/RequirementGenerator.ts`（256 行），对应 DC-0093 / GX-0051。

## 入口与调用链

- `@shop/requirementgen` 提供 `generate`（默认写入）与 `check`（传入 `--check`）两种入口；根 `check:requirements` 调用后者，根 `check:generated` 与 `quality:canonical-hard-cut` 也将其纳入生成制品质量门。
- 生成器从经 authority 校验的 workbook 读取需求事实，并与 `operations.yml`、固定 trace 定义组合；默认分支覆写五份受版本控制的 requirements 文档及 `01_core_hexin/packages/contract/src/RequirementCatalog.generated.ts`。
- `--check` 分支为每份预期内容读取当前文件并逐字比较，不相同即抛出 `GENERATED_REQUIREMENTS_DRIFT`；不进入 `writeFile`。当前审计环境此前在解析前因缺少 `fflate` 失败，此次不重复运行。

## 结论

- **GX 维持，不得删除、修改或运行默认模式。** 此生成器是 workbook/operations 到跨端需求合同和 TypeScript catalog 的唯一明确转换边界；“生成文件”或“工具目录无服务入口”均不能推导其无责任。
- 已知风险沿用首审 F-0316（无界 XLSX 解压）和 F-0317（启发式前端 trace）；本复核未改变严重级别，也未验证实际 workbook、依赖闭包或每份输出的当前内容一致性。
- 任何更改只能在最新主线独立治理分支进行，先以只读 `--check` 和逐制品差异建立证据，再经 Requirement/Contract Owner 复核权威 hash、输出消费者与回滚方案。
