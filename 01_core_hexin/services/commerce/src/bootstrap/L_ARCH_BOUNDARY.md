# 星准（L-Arch）｜商贸运行适配边界

状态：代码边界与评分快照；不是公共契约、产品规则或部署证明。

星准只做两件事：**按“节点 + 接口”选择是否接通，并把输入交给原处理者后原样返回结果。** 它不拥有会员、商铺、OP、订单、权限、Realm、数据库、域名或节点资料。

## 业务 HTTP 主线

```text
entry/*ApiMain.ts
  → 宿主状态文件恢复版本化覆盖状态
  → ApiBootstrap.ts 从现有 RouteRegistry 与 NodeManifest 安装默认连接
  → HttpApp.ts 命中“节点 + Operation ID”
  → 在解析请求体、CSRF、Gate 和业务处理之前检查 Arch
  → ArchBoard.exchange
      ├─ connected：交给原 handler
      └─ 其他状态：不调用 handler，返回 404
```

- `RouteRegistry` 仍负责 HTTP 方法和路径匹配；Arch 不复制路由。
- `OperationController` 与业务模块仍负责输入、权限和业务；Arch 不解释数据。
- hosted L 的真实 `node_id` 仍由原会话解析；Arch 只消费结果。
- hosted L 必须显式安装接口；首次请求不会自动接通。
- `runtime.health.*` 直接走运行健康处理者，不挂到 Arch。
- Jobs、Runner 与 Arch 并列，均不借道 HTTP 主板。
- 旧 `commerce-api` 是非活跃兼容源码，不计入当前 Release Engine 的活跃 API 覆盖。

## 当前代码验收

| 项目 | 代码事实 |
| --- | --- |
| 纯接线边界 | L-kernel 只保存通用连接状态，不含业务、域名、公司或数据库资料。 |
| 活跃 HTTP 覆盖 | 8 个 `bootstrapApi` 入口与外层公开商品接口均经过同一 Arch。 |
| 开关优先位置 | 节点解析后立即检查，断开时不再解析请求体、执行 CSRF、Gate 或业务 handler。 |
| 重启恢复 | 宿主从 `/var/lib/l-arch/state.json` 恢复版本化覆盖状态，再安装当前进程的默认接口目录。 |
| 多进程同步 | 所有 API 进程监听同一路径，按 revision 收敛；状态删除后回到该进程声明的默认连接。 |
| 唯一控制入口 | 仅回环监听的本机节点控制服务通过 `GET/PUT /v1/arch` 查看和修改状态；写入必须携带当前 revision，业务 API 不提供第二条修改路径。 |
| 防旁路 | 生产业务 `HttpApp` 未注入 Arch 时拒绝启动；活跃发布入口由自动测试从服务构建清单反查。 |
| 状态可靠性 | 无效标识或状态不会部分改板；运行进程拒绝 revision 倒退，控制端重复设置同一状态不重复写盘。 |
| 发布继承 | `L-kernel/**` 变化展开到实际引用它的服务，L-kernel 本身没有部署目标。 |
| hosted L | 不再首次访问自动安装，只有显式 `connected` 状态才能调用 hosted handler。 |
| 并列边界 | 健康检查、Jobs、Runner 明确不进入主板。 |

以上是代码与本地测试事实，不代替 GCP 部署验收。

代码中的 `L-ARCH-WIRING` 是定位标记，不授予文件新的业务权威。
