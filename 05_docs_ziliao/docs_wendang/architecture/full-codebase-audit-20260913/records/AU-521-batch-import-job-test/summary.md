# AU-521｜Batch import job 生命周期测试

- 审阅范围：`01_core_hexin/services/commerce/tests/job/Import.test.ts`（96 行）；定向追踪 `BatchImport.ts`、四类 import processor、job registry/runtime。
- 审阅方式：逐段人工阅读和静态注册追踪；未运行队列、Object Store 或数据库。

## 真实运行关系

Catalog/Inventory/Member/Voucher import API 形成 import job 与 queue item → JobsBootstrap/CatalogJobsRuntime 注册对应 processor → BatchImportProcessor 校验 job kind、读取并 hash/scan 验证对象、stage rows、可恢复 process、生成 formula-safe CSV failure report、完成或区分 permanent reject 与 temporary fault/retry。

## 审计结论

- **G0**：测试覆盖 catalog 完整阶段、对象 hash 不一致的永久拒绝、member/voucher 仅经队列的同一可恢复生命周期，且 report 对 spreadsheet formula 注入加 apostrophe。实现中 job kind mismatch、terminal state、abort、empty file、permanent error 集也有明确 fail-safe 路径。
- `process` 返回 false 时保留 worker 可恢复状态而不完成报告；这符合 batch continuation 语义，不能只因没有立即完成认定为失败或死代码。

## 未验证项

- Object Store scan/hash、CSV parser、DB stage/process transaction、Queue lease/retry、取消和大文件内存/时间限制均为 mock/static 证据，未在真实服务验证。
