# 星准接线覆盖现状（本地代码盘点）

本页只记录现有调用路径，不定义新接口、契约或上线门禁。这里的“接入”指请求经过 `ArchBoard.exchange`；不表示业务已迁入 L-kernel，也不表示已部署。

| 路径 | 当前接线情况 | 边界 |
| --- | --- | --- |
| `commerce` 的 8 个 `bootstrapApi` API 入口 | 已经过 Arch；从各实例已有的 `RouteRegistry` 与节点 manifest 挂载当前实际注册的业务接口 | 未挂载、已断开或已移除的接口均不调用原 handler；原 handler 与数据所有者不变 |
| `WebBusinessApiMain` 外层 `PublicCatalogHttpHandler` 的公开商品 GET | 已使用同一 `ArchBoard`，按该运行 manifest 的节点和现有 HTTP 接口标识挂载 | 仍由原公开商品处理者与数据库返回数据 |
| `runtime.health.*` 健康接口 | 明确不挂载，`HttpApp` 直接交给原健康处理者 | 健康检查与主板并列，不计入业务接口开关覆盖 |
| H6 等 hosted L 节点的标准已登录接口 | 现有会话先解析真实 hosted `node_id`；运行适配层首次安装并再次经过该节点接口的 Arch | 首次安装不会覆盖既有断开或移除；宿主接口断开时，hosted 不会绕过宿主 |
| H6 等 hosted L 节点的公开接口 | 按承载它的主权运行节点接线，不伪造无会话的 hosted 身份 | 若未来公开请求需要指向 hosted 节点，应由现有入口先提供真实节点上下文 |
| 旧 `commerce-api` 源码 | 保留为兼容资料，不在当前 Release Engine 的活跃服务目标内，不计入活跃 API 覆盖 | 若重新启用，必须通过自己的 Arch 适配器接入，不能借用新服务的覆盖率 |
| Jobs、Runner | 不进入当前 HTTP 接线面 | 与主板并列，继续使用各自真实入口 |

连接状态仍在进程内运行，但可以通过 `snapshot()` 导出，并在构造 `ArchBoard` 时由宿主重新注入。L-kernel 不选择 Redis、数据库或配置中心，也不保存任何节点资料；多进程共享和持久化由各 L 的运行层决定。未来 L 使用同一 `@shop/l-kernel/arch` 时，只提供自己的现有节点清单、接口目录和可选快照；Arch 不提供会员、订单或 OP 业务实现。
