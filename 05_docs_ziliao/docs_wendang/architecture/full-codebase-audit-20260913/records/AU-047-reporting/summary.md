# AU-047｜reporting 报表、投影与导出链深审

## 真实运行链

- Console `reports` 使用 SDK 调用 sales/products/malls/categories/channels/powderclass/voucherconsumption；URL cursor 会回灌下一页。
- `ReportingModule` 注册 HTTP 读取/导出操作；`JOB_CATALOG` 注册 projection（16 并发）与 export（4 并发）。
- projection job 以 inbox event 为事务锁定单位，投影、inbox 完成标记和 projection offset 在同一事务提交；成功后失效对应 versioned cache key。
- export 创建报告任务和 runtime job；worker 生成 CSV/XLSX、写对象存储、校验 scan/hash/size 后才标记完成。

## 发现

- [P2][F-0141] XLSX 导出把所有分页行累计在 `workbookRows` 中，缺少最大行数、最大字节数或流式写入。过滤条件可为空，导出任务可能在 120 秒时限或进程内存上限前耗尽资源；CSV 路径按页清空数组，不受同一问题影响。

## 边界与验证

- 未发现 P0。
- 定向测试入口已识别（Console/Commerce Vitest）；固定审计工作树缺 package-local `vitest`，未安装依赖，未运行。
- 未连接数据库、对象存储、队列或线上状态；未修改任何业务代码。
