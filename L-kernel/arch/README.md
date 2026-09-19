# Arch｜星准接线板

Arch 主板实现在 `src/arch/ArchBoard.ts`，属于 `@shop/l-kernel`。它只做节点和接口的接线、单接口接断、把输入交给原处理者并返回原结果。接口 ID 沿用现有 Operation ID；节点 ID 沿用现有请求节点上下文。Arch 不生成另一份路由、Realm、权限或业务事实。

## 接线

`bootstrapApi` 为 HTTP 运行实例提供 `arch`，从现有节点清单与已注册路由自动接入当前实例的全部接口；`HttpApp` 在现有 `RouteRegistry` 命中路由后查询该节点该接口的接线状态：

- `unmounted`：从未安装，不交给 handler。
- `connected`：经 `arch.exchange` 将原请求交给原 handler，原响应原样返回。
- `disconnected`：仅该节点该接口返回原有的 404 格式；不调用原 handler。
- `removed`：曾明确调用 `unmount` 卸下；同样阻断原 handler，只有显式 `mount` 才能恢复。

其他 L 运行实例只需沿用 `@shop/l-kernel/arch`，向 `arch.mountAll(nodeIds, interfaceIds)` 交出自己已有的节点 ID 与接口 ID；不复制主板，也不向主板提交域名、业务模块或数据库。重复安装不会重置已断开或已明确卸下的接口。安装后可用 `arch.setConnected(nodeId, operationId, false/true)` 独立接断，用 `arch.unmount(nodeId, operationId)` 卸下；卸下后须显式 `mount` 才能重接。`arch.inspect(nodeId, operationIds)` 可查看指定接口，`arch.snapshot()` 可导出全部已安装连接。宿主可把快照存到自己的存储，并用 `new ArchBoard(snapshot)` 在启动时恢复；存储本身不进入 L-kernel。

## 现有接入

八个 `bootstrapApi` 运行入口都接入各自实际注册的业务接口；独立运行入口以当前 manifest 的节点限定接线和入站 Host，完整 API 使用现有服务端节点注册表。`WebBusinessApiMain` 外层公开商品 GET 也使用同一块 Arch。节点入口校验留在运行层，不交给 Arch。会员、订单及其他业务、数据库、权限和 HTTP 路由继续由原模块处理。实际会员路径见 [接线图](WIRING.md)。

托管型 L 没有独立 manifest。对已有会话的标准操作，运行适配层使用原会话解析出的 hosted `node_id` 首次安装该接口并再穿一次 Arch；`mountAll` 不会覆盖该节点已有的断开或移除状态。主板不解析登录态或节点归属。若宿主接口已断，托管节点不能绕过宿主。公开接口、外部状态存储等边界见 [覆盖盘点](COVERAGE.md)。

`runtime.health.*` 由运行层直接处理，不挂载、不经过 Arch；Jobs 和 Runner 与主板并列。它们不是业务接口开关，也不计入主板覆盖率。

集成测试覆盖逐接口接断、数据传递、节点隔离，以及实际会员模块已注册路由的挂载。测试不执行生产会员交易，也不表示已部署。
