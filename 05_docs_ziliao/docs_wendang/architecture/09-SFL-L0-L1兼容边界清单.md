# SFL L0/L1 兼容边界清单

状态：工程收口清单  
适用标准：SFL 1.6
复核日期：2026-09-08

本文只登记兼容债，不与交付验收编号 `SFL-D01`～`SFL-D04` 混用。兼容项统一使用 `SFL-COMPAT-*`。

## 一、判断原则

出现 `L0`、`L1`、`zhudatuan` 或 `hbbtzn` 本身不是缺陷。以下情况才属于串线：

1. 共享内核按品牌、域名字符串或裸层级选择业务逻辑；
2. 缺少节点信息时默认回落到另一个节点；
3. 边缘参数或 Header 直接决定身份、权限、Scope、支付或落库归属；
4. 一个节点复用另一个节点的账号、Session、资源、密钥、支付或发布指针；
5. 文档宣称的隔离能力与生产实际进程、目录或数据库拓扑不一致。

稳定数据库 ID、历史迁移、品牌文案和节点实例声明可以保留。它们必须被当作实例数据，不能成为共享业务分支。

## 二、兼容债台账

| 编号 | 状态 | 兼容边界 | 当前责任 | 负责人 | 依赖与退出证据 | 复核期限 |
| --- | --- | --- | --- | --- | --- | --- |
| SFL-COMPAT-01 | 生产活跃；候选已退出 | `hbbtzn-alias` 将 L1 公网入口转发到 zhudatuan 上游并改写内容 | 候选 Worker 只保留 410 退役哨兵且 `routes=[]`；生产切流前仍按活跃兼容债处理 | Ethan 裁决；SFL 节点内核维护 | `api.hbbtzn.com` 专属 Tunnel、本地 4430 网关及 L1 独立进程上线；生产 Worker 路由为零；停止 Tunnel 后关闭式失败且 L0 零变化 | 2026-09-09 |
| SFL-COMPAT-02 | 已关闭 | 旧 `target/application/client/admin_origin` 参数翻译 | 身份页严格校验本节点参数，不再自动修正到另一节点 | 已由本次收口完成 | 反向参数、重复参数和错域测试通过；跨节点只接受一次性 Login Intent | 已完成 |
| SFL-COMPAT-03 | 已关闭 | 节点专用 target 名称归一 | target 只表达本域 `console/storefront`，节点来自 NodeContext 与 realm | 已由本次收口完成 | L0/L1 同名 target 分别落到本 realm；无跨域账号回落 | 已完成 |
| SFL-COMPAT-04 | 候选已关闭；生产待验 | 身份、购买 API 的静态 Origin 与旧回跳配置 | Origin 和返回地址只从当前 NodeManifest 的 DomainBinding 投影；`AUTH_RETURN_TARGETS` 已列为禁止环境键 | SFL 节点内核维护 | L0/L1 环境无旧映射，四入口生产回跳均留在本节点域名 | 2026-09-09 |
| SFL-COMPAT-05 | 已关闭 | `ClientEnvironment` 的 L0 默认值 | 活跃 Auth、Console、Storefront 只读取 SFL 投影，不以品牌值兜底 | 已由本次收口完成 | 构建缺参失败；L0/L1 对照测试通过 | 已完成 |

## 三、SFL-COMPAT-01 的当前事实

必须分开报告生产与候选：

- **生产现状**：L1 已有独立发布指针、Catalog 与 Web API 服务；身份、购买仍由共享物理进程承载，旧 Cloudflare Worker 仍借用 zhudatuan 上游。因此 SFL-23 与 SFL-25 为 `FAIL`。
- **本批候选**：`api.hbbtzn.com` 绑定专属 Tunnel，进入本地 TLS 网关 `127.0.0.1:4430`，再分别进入 Storefront 4410、Catalog 4431、Web 4432、Identity 4433、Purchase 4434、Payment Webhook 4436；支付任务另以节点 Scope 运行。Worker 候选无公网路由、不访问上游、只返回 410。

候选完成不能替代生产退出。Cloudflare 路由解除、L1 独立进程切入、登录与支付验证、停止 Tunnel 的关闭式失败演练及回滚快照全部完成后，才能把 SFL-COMPAT-01 改为“已关闭”。共享物理 ECS 和数据库集群可以保留，但不得再共享运行实例身份、配置、节点资源或发布指针。

## 四、保留项，不属于污染

| 类型 | 例子 | 裁决 |
| --- | --- | --- |
| 权威节点内核 | `SflNodeKernel.ts`、`SflNodeRegistry.ts` | 保留；共享内核不得出现品牌业务分支 |
| 节点实例声明 | `sfl-node-registry.declaration.json`、`projects_xiangmu/hbbtzn/**` | 保留；所有投影必须从同一登记表生成 |
| 稳定数据库标识 | `tenant-zhudatuan`、`mall-zhudatuan`、`role-zhudatuan-*` | 暂时保留；按 Scope/realm 验证实际归属，不做破坏性改名 |
| 历史迁移与角色 | `*_zhudatuan_*.sql`、`zhudatuanidentityapi` | 历史保留；新能力使用中立命名，旧记录不回写 |
| 品牌和界面文案 | 主打团、宏泰甄选及各自域名 | 只放在 Brand、DomainBinding 或实例数据中 |
| 测试夹具 | L0/L1 品牌对照数据 | 用于证明隔离，不作为运行默认值 |

## 五、退出判据

兼容项只有同时满足以下条件才能删除：

1. L0 与 L1 从同一不可变源码制品构建，并记录真实源码 SHA 与制品摘要；
2. 每个 Host 只解析到一个 NodeManifest 和 NodeContext，并经本节点专属边缘／Tunnel／网关进入本节点进程；
3. 账号、Session、Membership、Scope、资源、支付、回调和发布指针均带节点归属；
4. 裸参数不能改变节点，跨节点只能使用服务端签发的一次性 Login Intent；
5. 正向、反向、错域、重放和生产入口测试全部通过；
6. 生产 Worker 路由为零，旧路径无流量，并保留 DNS、Worker、Tunnel、网关、进程和发布指针的明确回滚点；
7. 停止 L1 Tunnel 或网关只令 L1 关闭式失败，L0 入口、进程 PID 和业务事实逐项零变化。

未满足退出判据的兼容层可以服务历史流量，但不得重新成为新节点生成流程的配置真相。
