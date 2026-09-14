# AU-015 验证结果

- 正式test/typecheck均因缺`vitest`/`tsc`退出127，源码未加载。
- MutationQueue合成探针：write成功后onCommitted抛错，flush拒绝且onError收到rollbackValue=2（新confirmed）。
- ActionCoordinator合成探针：同key duplicate声明另一Result，实际共享首个string Promise。
- FeedbackStore合成探针：发布后修改原message，snapshot引用不变但内容静默变化。
- ResourceCache合成探针：dispose后read(storage)仍返回并缓存值。
- 全部使用合成值和固定源码；未改业务、未连接线上、未安装依赖。
