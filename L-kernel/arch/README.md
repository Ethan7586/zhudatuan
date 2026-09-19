# Arch｜星准接线板

Arch 主板实现在 `src/arch/ArchBoard.ts`，属于 `@shop/l-kernel`。它只做节点和接口的接线、单接口接断、把输入交给原处理者并返回原结果。接口 ID 沿用现有 Operation ID；节点 ID 沿用现有请求节点上下文。Arch 不生成另一份路由、Realm、权限或业务事实。

## 接线

`bootstrapApi` 为 HTTP 运行实例提供 `arch`，从现有节点清单与已注册路由自动接入当前实例的全部接口；`HttpApp` 在现有 `RouteRegistry` 命中路由后查询该节点该接口的接线状态：

- `unmounted`：从未安装，不交给 handler。
- `connected`：经 `arch.exchange` 将原请求交给原 handler，原响应原样返回。
- `disconnected`：仅该节点该接口返回原有的 404 格式；不调用原 handler。
- `removed`：曾明确调用 `unmount` 卸下；同样阻断原 handler，只有显式 `mount` 才能恢复。

其他 L 运行实例只需沿用 `@shop/l-kernel/arch`，向 `arch.mountAll(nodeIds, interfaceIds)` 交出自己已有的节点 ID 与接口 ID；不复制主板，也不向主板提交域名、业务模块或数据库。重复安装不会重置已断开或已明确卸下的接口。安装后可用 `arch.setConnected(nodeId, operationId, false/true)` 独立接断，用 `arch.unmount(nodeId, operationId)` 卸下；卸下后须显式 `mount` 才能重接。`arch.inspect(nodeId, operationIds)` 可查看指定接口，`arch.snapshot()` 可导出全部已安装连接，`replace(snapshot)` 可由宿主原子替换内存状态；存储本身不进入 L-kernel。

## 现有接入

八个 `bootstrapApi` 运行入口都接入各自实际注册的业务接口；独立运行入口以当前 manifest 的节点限定接线和入站 Host，完整 API 使用现有服务端节点注册表。`WebBusinessApiMain` 外层公开商品 GET 也使用同一块 Arch。节点入口校验留在运行层，不交给 Arch。会员、订单及其他业务、数据库、权限和 HTTP 路由继续由原模块处理。实际会员路径见 [接线图](WIRING.md)。

托管型 L 没有独立 manifest。对已有会话的标准操作，运行适配层使用原会话解析出的 hosted `node_id` 再穿一次 Arch；未显式安装的 hosted 节点接口保持 `unmounted`，第一次请求不会自动打开。主板不解析登录态或节点归属。若宿主接口已断，托管节点不能绕过宿主。公开接口、宿主状态等边界见 [覆盖盘点](COVERAGE.md)。

生产宿主使用 `/var/lib/l-arch/state.json` 保存版本化状态，API 进程监听同一文件并在 500 毫秒轮询周期内收敛。唯一修改入口位于与 Arch 并列、只监听回环地址的本机节点控制服务：`GET /v1/arch` 查看期望状态，`PUT /v1/arch` 携带当前 `expected_revision` 修改单个“节点 + 接口”。状态文件只含通用标识、状态和版本，不含任何 L 的业务资料。

生产业务 HTTP 装配没有 Arch 时拒绝启动；无效节点、接口或状态在改变主板前被拒绝。运行进程不会接受低于当前值的旧 revision，控制端对相同状态的重复请求保持幂等。`L-kernel/**` 变更由发布影响图自动展开到实际引用它的服务，L-kernel 自身仍不是部署目标。

`runtime.health.*` 由运行层直接处理，不挂载、不经过 Arch；Jobs 和 Runner 与主板并列。它们不是业务接口开关，也不计入主板覆盖率。

集成测试覆盖逐接口接断、数据传递、节点隔离，以及实际会员模块已注册路由的挂载。测试不执行生产会员交易，也不表示已部署。
