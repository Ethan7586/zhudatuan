# 星准（L-Arch）｜商贸运行适配边界

状态：代码边界与评分快照；不是公共契约、产品规则或部署证明。

星准只做两件事：**按“节点 + 接口”选择是否接通，并把输入交给原处理者后原样返回结果。** 它不拥有会员、商铺、OP、订单、权限、Realm、数据库、域名或节点资料。

## 业务 HTTP 主线

```text
entry/*ApiMain.ts
  → ApiBootstrap.ts 从现有 RouteRegistry 与 NodeManifest 安装连接
  → HttpApp.ts 命中“节点 + Operation ID”
  → ArchBoard.exchange
      ├─ connected：交给原 handler
      └─ 其他状态：不调用 handler，返回 404
```

- `RouteRegistry` 仍负责 HTTP 方法和路径匹配；Arch 不复制路由。
- `OperationController` 与业务模块仍负责输入、权限和业务；Arch 不解释数据。
- hosted L 的真实 `node_id` 仍由原会话解析；Arch 只消费结果。
- `runtime.health.*` 直接走运行健康处理者，不挂到 Arch。
- Jobs、Runner 与 Arch 并列，均不借道 HTTP 主板。
- 旧 `commerce-api` 是非活跃兼容源码，不计入当前 Release Engine 的活跃 API 覆盖。

## 95 分快照

| 指标 | 分数 | 代码事实 |
| --- | ---: | --- |
| 纯接线边界 | 20/20 | L-kernel 只保存通用连接状态，不含业务、域名、公司或数据库资料。 |
| 活跃 HTTP 覆盖 | 20/20 | 8 个 `bootstrapApi` 入口与外层公开商品接口均经过同一 Arch。 |
| 节点与接口独立开关 | 20/20 | 每个键由 `nodeId + interfaceId` 唯一确定，互不改动。 |
| 数据交接 | 15/15 | `exchange` 不改输入和输出，只决定是否调用原处理者。 |
| 并列边界 | 10/10 | 健康检查、Jobs、Runner 明确不进入主板。 |
| 观察与恢复接口 | 10/10 | `inspect`、`snapshot` 与构造注入支持查看和由宿主恢复。 |
| 多进程持久控制面 | 0/5 | L-kernel 不选存储；待具体 L 的运行层提供，不把节点资料塞回主板。 |
| **合计** | **95/100** | 剩余 5 分属于外部运行控制面，不靠加重主板取得。 |

代码中的 `L-ARCH-WIRING` 是定位标记，不授予文件新的业务权威。
