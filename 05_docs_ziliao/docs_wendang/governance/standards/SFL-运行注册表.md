---
registry_id: SFL-RUNTIME-REGISTRY
中文名称: SFL 运行注册表
version: '1.0.0'
status: REFERENCE
observed_at: '2026-09-12'
authority: 可变运行事实；不是标准，不具有永久规范权威
---

# SFL 运行注册表 v1.0.0

本注册表只记录某时点的运行事实、仓库声明和未知项。它不是标准，不能登记为 LAW 的 `ACTIVE` 标准，不能创造门禁、授权或产品规则。IP、域名、端口、数据库、systemd、Caddy 和制品路径变化时直接更新本表；无需提升 SFL 标准版本。

证据状态沿用 [`疆域标准 1.0.0`](05-疆域标准.md)：`CONFIRMED / DECLARED / OBSERVED / UNKNOWN`。

## 1. 共享阿里云实例

| 事实 | 值 | 状态 | 证据与时间 |
| --- | --- | --- | --- |
| 云厂商 | 阿里云 | `OBSERVED` | 第一批只读生产取证，2026-09-12 |
| ECS instance-id | `i-2zeewhay0farxq8lucrd` | `OBSERVED` | 第一批通过实例元数据核验，2026-09-12 |
| 公网 IPv4 | `123.57.232.253` | `OBSERVED` | 第一批运行取证及现有项目运行资料，2026-09-12 |
| 宿主性质 | 多项目共享宿主，现有项目资料登记 15 个域名 | `OBSERVED` | 第一批台账与当前项目运行规则；本批未重新枚举控制面 |
| RAM、ECS 安全组、RDS、OSS、DNS、证书控制面 | `UNKNOWN` | `UNKNOWN` | 本批禁止访问生产，且第一批未取得这些控制面事实 |

不得用域名、TLS 证书、服务内容或仓库配置反推实例身份。上表不是当前控制面的持续证明。

## 2. 网关与域名

| 对象 | 当前记录 | 状态 | 证据 |
| --- | --- | --- | --- |
| 共享公网网关 | 生产 `/etc/caddy/Caddyfile`；第一批观察 SHA-256 前缀 `919f0b87…` | `OBSERVED` | 第一批只读生产取证；本批未重查 |
| 仓库内 Caddy 声明 | `02_platform_pingtai/infrastructure/zhudatuan/aliyun/Caddyfile` | `DECLARED` | 版本库文件；不等同生产配置 |
| 节点本地网关模板 | `sfl-api-gateway@.service`，读取 `/opt/sfl/nodes/%i/runtime/api-gateway.Caddyfile` | `DECLARED` | 仓库 systemd 模板 |
| 主打团 L0 域名声明 | `accounts.fufu.wang`、`api.fufu.wang`、`console.fufu.wang`、`fufu.wang`、`www.fufu.wang`、`h5.fufu.wang`、`internal.fufu.wang`、`beta.fufu.wang`、`mini.fufu.wang` | `DECLARED` | `sfl-node-registry.declaration.json` |
| hbbtzn L1 域名声明 | `accounts.hbbtzn.com`、`api.hbbtzn.com`、`console.hbbtzn.com`、`hbbtzn.com`、`www.hbbtzn.com`、`h5.hbbtzn.com`、`mall.hbbtzn.com` | `DECLARED` | `sfl-node-registry.declaration.json` |
| 其他仓库路由声明 | `media.zhudatuan.com`、`chat.zhudatuan.com`、`labs.zhudatuan.com` | `DECLARED` | 仓库 Caddyfile；当前生产是否启用 `UNKNOWN` |

## 3. 节点、Realm 与身份服务

| 对象 | 当前记录 | 状态 | 证据 |
| --- | --- | --- | --- |
| 主打团经营线 | `line:zhudatuan:commerce:v1`（历史字段名 `line_id`） | `DECLARED` | 节点注册声明 v1.6.1 |
| 主打团 L0 节点 | `node:zhudatuan:l0`、`mall-zhudatuan`、`realm:l0` | `DECLARED` | 节点注册声明和 NodeManifest；未在本批核验运行一致性 |
| hbbtzn L1 节点 | `node:hbbtzn:l1`、父节点 `node:zhudatuan:l0`、独立 `mall_id` | `DECLARED` | 节点注册声明；未在本批核验运行一致性 |
| 通用节点身份 API | `sfl-identity-api@.service` | `DECLARED` | 仓库 systemd 模板 |
| 主打团身份／业务 API | `zhudatuan-api.service`，仓库声明监听 `127.0.0.1:4321` | `DECLARED` | 仓库 systemd unit |
| 身份通知任务 | `sfl-identity-notification-jobs@.service`、`zhudatuan-identity-notification-jobs.service` | `DECLARED` | 仓库 systemd units |
| 当前生产进程 PID、版本、健康与端口占用 | `UNKNOWN` | `UNKNOWN` | 本批未访问生产 |

## 4. 端口与数据库声明

| 用途 | 声明值 | 状态 | 来源 |
| --- | --- | --- | --- |
| Storefront | `4310` | `DECLARED` | `sfl-storefront.env.example` |
| 主业务 API | `4321` | `DECLARED` | `zhudatuan-api.service` |
| Web Business API | `4322` | `DECLARED` | `zhudatuan-web-api.service` |
| Purchase API | `4323` | `DECLARED` | `zhudatuan-purchase-api.service` |
| Console Support API | `4324` | `DECLARED` | `zhudatuan-console-support.service` |
| Mall Provisioning API | `4325` | `DECLARED` | 对应 systemd units |
| Payment Webhook API | `4326` | `DECLARED` | `zhudatuan-payment-webhook-api.service` |
| Catalog API | `4331` | `DECLARED` | `zhudatuan-catalog-api.service` / env example |
| 本地 Secret / KMS / Object Store | `8543 / 8544 / 8545`；部分节点模板使用 `8553 / 8544 / 8555` | `DECLARED` | runtime env examples；当前占用 `UNKNOWN` |
| PostgreSQL 声明 | `127.0.0.1:55432/zhudatuan_registration` | `DECLARED` | bootstrap env examples；当前生产数据库与迁移状态 `UNKNOWN` |

示例配置只能证明预期绑定，不证明端口正在监听、数据库存在或凭据有效。本注册表不保存任何凭据明文。

## 5. systemd 声明

仓库当前包含两组 unit 声明：

- 节点模板：`sfl-api-gateway@`、`sfl-storefront@`、`sfl-identity-api@`、`sfl-purchase-api@`、`sfl-catalog-api@`、`sfl-catalog-jobs@`、`sfl-payment-webhook-api@`、`sfl-payment-jobs@`、`sfl-mall-provisioning-api@`、`sfl-secret-store@`、`sfl-catalog-object-store@`、`sfl-cloudflared@`、`sfl-web-api@`、`sfl-identity-notification-jobs@`。
- 主打团固定 units：`zhudatuan-api`、`zhudatuan-web-api`、`zhudatuan-purchase-api`、`zhudatuan-console-support`、`zhudatuan-mall-provisioning-api`、`zhudatuan-catalog-api`、`zhudatuan-catalog-jobs`、`zhudatuan-payment-webhook-api`、`zhudatuan-payment-jobs`、`zhudatuan-identity-notification-jobs`、`zhudatuan-internal-runtime`、`zhudatuan-object-store` 及一次性 bootstrap／migration／release-policy units。

第一批仅确认多个目标 unit 在当时 active，以及 `zhudatuan-release-policy.timer/path` 当时 active/waiting。本批未重查 enablement、MainPID、启动命令或健康状态，均为 `UNKNOWN`。

## 6. 运行制品与选择点

| 对象 | 声明／观察 | 状态 |
| --- | --- | --- |
| 主打团节点发布指针 | `/opt/sfl/nodes/zhudatuan-l0/current` | `DECLARED`（节点注册声明） |
| 节点目标发布指针 | `/opt/sfl/nodes/%i/targets/<target>/current` | `DECLARED`（systemd 模板） |
| 主打团固定目标指针 | `/opt/zhudatuan/targets/<target>/current` | `DECLARED`（systemd units） |
| 回滚记录 | `/opt/ai-delivery/rollback/zdt-next/**` 在第一批观察到存在 | `OBSERVED`，本批未重查 |
| 当前源码 SHA、制品摘要、manifest 版本、实际指针目标 | `UNKNOWN` | 本批未访问生产控制面 |

## 7. 更新纪律

1. 新事实写明观察时间、对象、值、证据状态和来源；无法证明写 `UNKNOWN`。
2. 不把仓库声明升级为当前运行事实，不把一次观察升级为永久保证。
3. 注册表更新不能启用标准、批准外部操作或改变业务语义。
4. 涉及 gsyen 的运行事实留在其疆域或其自身注册表；没有证据时不把 gsyen 挂到主打团阿里云实例。
