# AU-015｜`@shop/interaction` 交互状态与异步编排

## 1. 边界

- 固定基线`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；开工检查点CP-14 `e8daefc4`。
- 深入审阅14/14文件、971/971行：575行生产源码、364行测试、32行package/tsconfig。
- 反追8个生产源码消费者：Auth、Console和Storefront的动作协调、缓存、预加载、toast与购物车数量同步。
- 不展开页面业务、不修复、不安装依赖、不改源码/测试/配置、不推送/合并/部署。

## 2. 结论

[FACT][E-AU-015-002/003] 包无独立进程、数据表或发布单元；全部五类核心能力和React subpath都有真实生产消费者。21个直接测试覆盖去重、并发键、取消、失败回滚、持久化、预加载重试和timer释放。

[CONFLICT][E-AU-015-004] KeyedMutationQueue在远端write成功后先更新confirmed，再调用`onCommitted`；若观察回调抛错，会进入write失败catch、调用onError并拒绝flush，rollbackValue却已是新确认值。形成F-0070/P3；当前Storefront onCommitted写缓存时内部吞持久化异常，是缓解项。

[CONFLICT][E-AU-015-005] KeyedActionCoordinator把Result声明为每次start独立泛型；同key重复start可请求不同Result类型，却共享首个Promise。实际探针让声明为number的duplicate解析为string，形成F-0071/P3。Auth当前按固定action key约定使用，未发现实际跨类型调用。

[CONFLICT][E-AU-015-006/007] FeedbackStore公开`readonly Message[]`但保存并返回原始可变message引用，外部修改后snapshot identity不变且不通知订阅者；ResourceCache dispose后read仍可从storage重新写回memory。分别形成F-0072/P3、F-0073/P3。

本AU新增P3 4项，无新增垃圾候选。累计P0 0、P1候选9、P2 37、P3 26、NIT 1；G0 2、G1 16、G2 1、G3 0、GX 1。

## 3. 值得保留与未知

- Mutation queue按key串行、跨key并行，并以generation抑制cancel后的陈旧callback；测试覆盖快速五连击和活动写后续排队。
- Action coordinator显式给出revision/isLatest和AbortSignal，Auth consumer正确用它忽略迟到响应。
- Preload失败会删除当前task并允许重试；Console和Storefront都共享该行为。
- Resource持久化失败被隔离在可选cache边界，不阻断应用内存状态。
- [UNKNOWN] 仓外消费者是否依赖上述边界行为；正式test/typecheck因缺vitest/tsc退出127，未安装依赖。
