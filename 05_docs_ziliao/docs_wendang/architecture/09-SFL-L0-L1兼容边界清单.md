# SFL L0/L1 兼容边界清单

状态：工程收口清单  
适用标准：SFL 1.5  
目的：集中区分合法节点实例配置、稳定历史标识与待退出兼容层，防止把品牌字符串误判成架构串线，也防止兼容代码重新成为业务真相。

## 一、判断原则

出现 `L0`、`L1`、`zhudatuan` 或 `hbbtzn` 本身不是缺陷。只有以下情况属于串线：

1. 共享业务内核按品牌、域名或裸层级选择业务逻辑；
2. 缺少节点信息时默认回落到另一个节点；
3. 边缘代理、前端参数或 Header 直接决定身份、权限、数据范围或落库归属；
4. 一个节点复用另一个节点的账号、Session、资源绑定、支付绑定或发布指针。

实例清单、项目部署文件、品牌文案、测试夹具、历史迁移文件名和已经落库的稳定 ID 可以保留。稳定 ID 的名称陈旧不等于数据串线，不得为了改名破坏历史引用。

## 二、集中清单

| 编号 | 位置 | 当前性质 | 允许行为 | 禁止行为 | 收口方向 |
| --- | --- | --- | --- | --- | --- |
| SFL-D01 | `02_platform_pingtai/infrastructure/zhudatuan/cloudflare/hbbtzn-alias/src/index.ts` | L1 到共享物理源站的边缘兼容层 | 转发旧入口、改写公开链接、传递经验证的原始入口事实 | 直接决定节点身份、权限、Scope、支付或业务归属 | 由 NodeManifest 生成路由；源站按可信公开 Host 解析唯一 NodeContext 后退出参数改写 |
| SFL-D02 | `01_core_hexin/apps/auth-web/src/services/consumerIdentityEntry.ts` 及边缘旧参数处理 | 旧 `target/application/client/admin_origin` 入口翻译 | 将旧链接翻译成当前节点入口，或明确拒绝不匹配 | 自动带用户跨节点、据此授权或选择其他节点账号 | 由服务端签发的 LoginIntent 取代裸查询参数 |
| SFL-D03 | `01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/IdentitySecurity.ts` | 节点专用 target 到业务入口类别的兼容归一 | 在 realm 与 NodeContext 已确定后，把旧名称归为 console/storefront 类别 | 用归一后的类别合并节点账号、Session 或 Membership | AuthTarget 改为节点无关 surface，节点信息只来自 NodeContext/realm |
| SFL-D04 | `01_core_hexin/packages/config/src/IdentityRegistrationApiEnvironment.ts`、`WebBusinessApiEnvironment.ts`、`PurchaseApiEnvironment.ts` | 双节点静态 Origin 白名单 | 在迁移期明确列出允许 Origin | 用列表顺序或缺省值推断节点 | 从 NodeManifest 的 DomainBinding 生成每个运行实例的 Origin 集合 |
| SFL-D05 | `01_core_hexin/packages/config/src/ClientEnvironment.ts` | 旧 L0 单节点客户端配置 | 仅供尚未迁移的旧调用者 | 作为新 Console、Storefront 或身份入口的配置真相 | 无运行调用者后删除；新代码只使用 SFL 投影配置 |

## 三、保留项，不属于污染

| 类型 | 例子 | 裁决 |
| --- | --- | --- |
| 权威节点内核 | `SflNodeKernel.ts`、`SflNodeKernelConsole.ts` | 保留；共享内核不得出现品牌业务分支 |
| 节点实例清单 | `console-node-manifests.json`、`projects_xiangmu/hbbtzn/**` | 保留；实例必须明确写自己的域名、品牌和资源引用 |
| 稳定数据库标识 | `tenant-zhudatuan`、`mall-zhudatuan`、`role-zhudatuan-*` | 暂时保留；按 Scope/realm 验证实际归属，不做字符串改名 |
| 历史迁移与数据库角色 | `*_zhudatuan_*.sql`、`zhudatuanidentityapi` 等 | 保留历史；新能力采用中立命名，旧记录不回写 |
| 品牌与界面文案 | 主打团、宏泰甄选及对应域名 | 保留在 Brand/NodeManifest/实例项目中，不进入共享规则分支 |
| 测试夹具 | L0、L1 和具体品牌对照数据 | 保留；用于证明隔离，不作为运行默认值 |

## 四、已直接修复

统一身份前端过去只会从 `accounts.hbbtzn.com` 推导 `api.hbbtzn.com`，而 `accounts.zhudatuan.com` 在构建配置缺失时可能沿用 L1 默认 API。现已改为两个 Accounts Host 都从自身域名推导同节点 API，并增加 L0/L1 对照测试。

## 五、退出判据

一个兼容项只有同时满足以下条件才能删除：

1. L0 与 L1 均从同一不可变制品启动；
2. Host 只解析到一个已登记 NodeManifest 与 NodeContext；
3. 账号、Session、Membership、Scope、资源、支付和发布指针均带节点归属；
4. 裸参数篡改不能改变节点，跨节点只能使用服务端 LoginIntent；
5. 对应正向、反向和重放测试通过；
6. 生产观测证明不再有旧入口流量，且保留可回滚版本。

兼容项尚未退出时应标记 `SFL-Dxx`，可以继续服务历史流量，但不得被新节点生成流程依赖。
