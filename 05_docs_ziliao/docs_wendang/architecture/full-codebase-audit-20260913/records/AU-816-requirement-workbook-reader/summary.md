# AU-816｜需求 Workbook 读取链

- 审阅范围：`RequirementSource.ts`（75 行）、`WorkbookReader.ts`（124 行）和测试（14 行）。
- **F-0316/P3：** `Workbook`构造器直接对完整authority XLSX执行`unzipSync(bytes)`，无压缩大小、条目数或解压后大小限制。Authority的仓内realpath/SHA-256冻结降低了外部输入风险，但受审提交可引入异常大型权威工作簿并在generate/check阶段耗尽内存。
- Source固定8个sheet、20个provider和21个MVP routes/journeys/runbooks；Reader支持sparse cell、rich shared string和XML entity。两项Vitest源码反例已读，但官方test因Vitest缺失未启动。
- 三文件均为 requirement generation 规格/读取职责，**G0**。
