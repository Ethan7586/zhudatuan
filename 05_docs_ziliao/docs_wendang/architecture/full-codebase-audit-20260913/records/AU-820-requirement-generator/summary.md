# AU-820｜RequirementGen 主生成器

- 审阅范围：`RequirementGenerator.ts`（256 行）及 package check/generate entry。
- 结论：从受Authority hash冻结的workbook和operations定义推导296 requirements、21 MVP、20 providers与前端trace；写入5份requirements文档和`RequirementCatalog.generated.ts`。`--check`只比较字节，默认模式写入这些受审制品。
- 正式`npm run check --workspace @shop/requirementgen`在解析前因`fflate`缺失退出1；未安装依赖，也未进入写入分支。该环境缺失已在全局质量档案记录。
- 生成器复用F-0316的无界unzip与F-0317的启发式trace风险；本文件为 **GX**，任何修改须独立生成证据、逐输出diff和二次复核。
