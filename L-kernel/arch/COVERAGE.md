# 星准接线覆盖现状（本地代码盘点）

本页只记录现有调用路径，不定义新接口、契约或上线门禁。这里的“接入”指请求经过 `ArchBoard.exchange`；不表示业务已迁入 L-kernel，也不表示已部署。

| 路径 | 当前接线情况 | 边界 |
| --- | --- | --- |
| `commerce` 的 8 个 `bootstrapApi` API 入口 | 已经过 Arch；从各实例已有的 `RouteRegistry` 与节点 manifest 挂载当前实际注册的接口 | 仅已解析到节点的接口可按节点接断；原 handler 与数据所有者不变 |
| `WebBusinessApiMain` 外层 `PublicCatalogHttpHandler` 的公开商品 GET | 未接入；它先于 `HttpApp` 处理请求，不在 `routes.catalog()` 中 | 不借用别的 Operation ID，也不在过渡期新造局部公共接口代号 |
| 旧 `commerce-api` 自有路由（包括公开商品路由） | 未接入；它不通过上述 `bootstrapApi` | 不能把新 `commerce` 的覆盖率算到旧服务上 |
| `runtime.health.*` 健康接口 | 经过 Arch 调用，但请求不绑定业务节点，状态为 `unmounted`，因此原样放行 | 不计入“按 L 节点独立接断”覆盖 |
| H6 等 hosted L 节点的标准已登录接口 | 现有会话先解析真实 hosted `node_id`；非生成的运行适配层再让该节点与接口经过 Arch | hosted 没有独立 manifest，须在运行侧为该节点接口挂线；宿主接口断开时，hosted 不会绕过宿主 |
| H6 等 hosted L 节点的公开接口 | 尚未按 hosted 节点接线 | 外层公开商品入口没有会话节点，也不在现有接口目录中 |
| Jobs、Runner 等非 HTTP 路径 | 未接入当前 HTTP 接线面 | 需要按各自真实入口单独盘点，不能用 HTTP 接线结果冒充覆盖 |

现阶段只完成本地代码接线；连接状态仍为进程内存，重启不保留，多个进程之间也不共享。现有 Redis 接口是带过期时间的缓存，不是已确定的长期接线状态来源；当前也没有通用持久开关表，不能把缓存误报成持久开关。未来 L 若使用同一 `@shop/l-kernel/arch`，还需提供自己的现有节点清单、接口目录和运行实例接入；Arch 不提供会员、订单或 OP 业务实现。
