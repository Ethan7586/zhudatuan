# 星准接线覆盖现状（本地代码盘点）

本页只记录现有调用路径，不定义新接口、契约或上线门禁。这里的“接入”指请求经过 `ArchBoard.exchange`；不表示业务已迁入 L-kernel，也不表示已部署。

| 路径 | 当前接线情况 | 边界 |
| --- | --- | --- |
| `commerce` 的 8 个 `bootstrapApi` API 入口 | 已经过 Arch；从各实例已有的 `RouteRegistry` 与节点 manifest 挂载当前实际注册的业务接口 | 未挂载、已断开或已移除的接口均不调用原 handler；原 handler 与数据所有者不变 |
| `WebBusinessApiMain` 外层 `PublicCatalogHttpHandler` 的公开商品 GET | 已使用同一 `ArchBoard`，按该运行 manifest 的节点和现有 HTTP 接口标识挂载 | 仍由原公开商品处理者与数据库返回数据 |
| `runtime.health.*` 健康接口 | 明确不挂载，`HttpApp` 直接交给原健康处理者 | 健康检查与主板并列，不计入业务接口开关覆盖 |
| H6 等 hosted L 节点的标准已登录接口 | 现有会话先解析真实 hosted `node_id`，再经过该节点接口的 Arch | hosted 节点接口必须由宿主状态显式安装；未安装、断开或移除均不调用 handler |
| H6 等 hosted L 节点的公开接口 | 按承载它的主权运行节点接线，不伪造无会话的 hosted 身份 | 若未来公开请求需要指向 hosted 节点，应由现有入口先提供真实节点上下文 |
| 旧 `commerce-api` 源码 | 保留为兼容资料，不在当前 Release Engine 的活跃服务目标内，不计入活跃 API 覆盖 | 若重新启用，必须通过自己的 Arch 适配器接入，不能借用新服务的覆盖率 |
| Jobs、Runner | 不进入当前 HTTP 接线面 | 与主板并列，继续使用各自真实入口 |

L-kernel 仍只维护进程内状态，不选择 Redis、数据库或配置中心。当前 Commerce 宿主把版本化覆盖状态保存在 `/var/lib/l-arch/state.json`，每个 API 进程读取同一文件并重装自己的默认接口目录；重启会恢复相同版本，文件更新会同步到所有进程。节点控制服务是唯一写入口，Jobs、Runner 和健康检查仍不经过 Arch。未来 L 只需提供自己的默认节点与接口目录，并沿用同一宿主状态适配；Arch 不提供会员、订单或 OP 业务实现。

发布侧从当前 `service-targets.mjs` 自动核对全部活跃业务 API 入口，并把 `L-kernel/**` 的变化只展开到引用它的十个 Commerce 服务。测试同时证明 24 个节点、40 个接口的 960 个开关保持逐项隔离；这验证接线规模，不冒充生产业务部署。
