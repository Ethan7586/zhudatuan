# AU-001｜条件分支与状态骨架

## 1. Console 模块注册

| 状态/条件 | 输入 | 结果 | 失败 | 恢复 |
| --- | --- | --- | --- | --- |
| 重复 module ID | manifest 数组 | issue `duplicate-module-id` | define 阶段抛错 | 修正 manifest；本审计不实施 |
| 每模块 entry 数不等于 1 | routes | issue `entry-count` | define 阶段抛错 | 同上 |
| 重复 route ID/path | routes | 对应 issue | define 阶段抛错 | 同上 |
| status=hidden | manifest | 不生成任何 route | 无 | 改配置后重建 |
| status=disabled | route | lazy 载入 ModuleDisabledRoute | 动态 import 失败传播 | 页面级错误边界待审 |
| kind=redirect | route | Navigate replace | 无显式恢复 | 浏览器路由返回 |
| enabled route | route | loadConsoleModuleRoute lazy | Promise 失败传播 | 错误边界待审 |

## 2. Commerce ModuleRegistry

| 当前状态 | 操作 | 下一状态 | 拒绝条件 | 副作用 | 失败结果 |
| --- | --- | --- | --- | --- | --- |
| 空/已收集 | add | 增加模块 | 相同 ID | Map 写入 | 抛 MODULE_DUPLICATE |
| 已收集 | load | 逐依赖注册 | 缺依赖/循环 | 每个 module.register 可产生外部副作用 | 抛错；已注册模块不自动回滚，完整影响 UNKNOWN |
| 任意 | catalog | 不变 | 无 | 返回排序后的冻结数组 | 无 |

关键未知：`load` 串行 await，但 registry 本身没有补偿。某模块注册中途失败后，前序容器、route、job 或 extension 状态是否被丢弃取决于 bootstrap 生命周期，留给 AU-003。

## 3. RouteRegistry

| 当前状态 | 操作 | 下一状态 | 拒绝/忽略 | 结果 |
| --- | --- | --- | --- | --- |
| mutable | register allow-list 外 operation | mutable | 静默忽略 | 无 route |
| mutable | register 重复 method/path | mutable | 抛 ROUTE_DUPLICATE | 不写入 |
| mutable | freeze 且 expected 缺失 | mutable | 抛 ROUTE_OPERATIONS_MISSING | 未冻结 |
| mutable | freeze 完整 | frozen | 无 | routes 数组冻结 |
| frozen | register | frozen | 抛 ROUTE_REGISTRY_FROZEN | 无写入 |
| mutable | match | mutable | 抛 ROUTE_REGISTRY_NOT_FROZEN | 无匹配 |
| frozen | match | frozen | method/path 不匹配返回 null | 命中时 decode path 参数 |

`decodeURIComponent` 对非法百分号会抛异常；其 HTTP 映射不属于 registry 文件本身，留给 HttpApp 专项。

## 4. JobRegistry

| 当前状态 | 操作 | 下一状态 | 拒绝条件 | 结果 |
| --- | --- | --- | --- | --- |
| mutable | register | mutable | frozen、重复 ID、lease<5、batch<1、concurrency<1、deadline<100 | 保存定义 |
| mutable | freeze | frozen | 无 | 阻止后续注册 |
| mutable | all | mutable | 抛 JOB_REGISTRY_NOT_FROZEN | 无返回 |
| frozen | all | frozen | 无 | 返回冻结的新数组 |

## 5. Storefront fetch

分支顺序固定为：labs path 404 → runtime config 503 → showcase path 404 → Compatibility API Response → vinext Response。前序分支短路后序调用。`routePublicRequest` 和 vinext handler 的异常、超时与取消语义未在本 AU 展开。

## 6. 发布影响选择

| 条件 | workspace impact | service impact |
| --- | --- | --- |
| 仅测试/文档 | 空 targets | 测试文件从 changed 中移除 |
| 根 package.json 变化 | 可达 target 上界 | 不适用该 resolver |
| lockfile 无法读取旧版本 | 所有 workspace 视为变化 | 不适用 |
| 找到消费者 | 反向依赖映射 target | esbuild 输入图映射 target |
| 无映射/无法收窄 | 可达 target 上界 | 全部 serviceTargets |

该策略倾向避免漏发布；分类规则是否遗漏部署工具文件需 release 专项逐条审阅。
