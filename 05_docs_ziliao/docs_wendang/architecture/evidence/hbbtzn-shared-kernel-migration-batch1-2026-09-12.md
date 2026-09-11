# 版本名称：宏泰共享内核迁移 · 第一批｜取证、Dry-run 对账与切换候选

日期：2026-09-12  
本地分支：`feature/hbbtzn-shared-runtime-cutover`  
合并目标：`zdt-next`  
切换候选提交：`cb61a02598ffbf1f776e5e47214e194e685c5444`  
候选中文名称：宏泰共享运行时切换候选 v1  
状态：第一批完成；未 push、未开 PR、未 merge、未部署、未切流。

## 1. 范围与结论

本批只完成生产只读取证、数据库对账、发布/网关候选、定向测试、构建打包和 Dry-run。没有执行 `install --mode agent`、`seed`、`install --mode runtime-candidate`、生产 `deploy`、`rollback`、网关安装/重载、生产指针切换或数据库写入。

结论：宏泰 `realm:l1` 的业务数据已经位于 L0 服务使用的同一 PostgreSQL 实例和同一数据库中，不需要复制表数据；第二批实质是把宏泰流量从旧 443x 进程切到共享 432x/4331 进程，同时保持 `realm:l1`、商城、组织和会员边界不变。

## 2. 本任务未产生生产变更的证据

### 2.1 第一批前后 PID

首次取证与 `agent-candidate` 后置检查逐项相同：

| 运行时 | MainPID（前 = 后） |
| --- | ---: |
| `sfl-catalog-api@zhudatuan-l0.service` | 3863561 |
| `sfl-web-api@zhudatuan-l0.service` | 3862485 |
| `sfl-identity-api@zhudatuan-l0.service` | 3862457 |
| `sfl-purchase-api@zhudatuan-l0.service` | 3862532 |
| `sfl-payment-webhook-api@zhudatuan-l0.service` | 3862588 |
| `sfl-catalog-jobs@zhudatuan-l0.service` | 3863670 |
| `sfl-payment-jobs@zhudatuan-l0.service` | 3863639 |
| `zhudatuan-console-support.service` | 605404 |
| `sfl-api-gateway@hbbtzn-l1.service` | 1444108 |
| `sfl-cloudflared@hbbtzn-l1.service` | 1444110 |
| `sfl-storefront@hbbtzn-l1.service` | 4028566 |
| `sfl-catalog-api@hbbtzn-l1.service` | 1599486 |
| `sfl-web-api@hbbtzn-l1.service` | 1552420 |
| `sfl-identity-api@hbbtzn-l1.service` | 1592106 |
| `sfl-purchase-api@hbbtzn-l1.service` | 1240306 |
| `sfl-payment-webhook-api@hbbtzn-l1.service` | 3500239 |
| 宏泰 Identity notification jobs（明确保留） | 3538519 |

`agent-candidate` 只上传并检查了 22,011 字节的候选安装包，远端根为 `/opt/ai-delivery/bootstrap/c32b702f0876ca2f3548f757c23dee8596a56fb9-4b644d...`；检查结果明确为：未安装 agent/策略、未修改指针、未 reload/restart、未切换流量。

重新基于最新 `origin/zdt-next` 生成的六服务 Dry-run 结果为：`artifactBytes=0`、`uploadedBytes=0`、`candidate=0ms`、`cutover=0ms`、`restart=0ms`，因此该轮同样没有触达生产。

### 2.2 并发发布说明

2026-09-12 的只读 `verify` 显示宏泰 Identity MainPID 已变为 `1654025`，且远端存在 `df9775f0`（PR #100）的候选/previous 记录；这与本任务早期基线 `1592106` 不同。同期网关 `1444108`、Tunnel `1444110`、Storefront `4028566`、Support `605404` 均仍与本任务基线一致。

因此能严格证明的是“本任务零生产写入”，不能声称整个观察窗口内生产没有被其他任务改变。该 Identity 变化来自本任务之外的并发发布链；本任务没有运行任何可造成该变化的生产命令。

### 2.3 生产指针复核

| 目标 | 当前指针/状态 |
| --- | --- |
| 宏泰 node current | `/opt/sfl/nodes/hbbtzn-l1/releases/0c02206d-console-senior-admin-v2` |
| 宏泰 Console current | `/opt/sfl/nodes/hbbtzn-l1/targets/console/releases/929fe393442fb66ab4e1bb7b62b6546c32a256cc-5ed0ad134fc039e1f6d92852a949366cd33a2b2b3d899fa695b86bf09022380b-7fd31f28a99cfa3bf18db56468558753f6d8037c35da87dd1cccccad6127ba41` |
| 宏泰 Console previous | `/opt/sfl/nodes/hbbtzn-l1/targets/console/releases/b99ac9ea-transient-notice` |
| 宏泰 Identity current | `/opt/sfl/nodes/hbbtzn-l1/targets/identity-api/releases/ea2d4931935b18232bab621a90b35f4acb0669bb-0479668e0fd2f582-595608f5ea941997` |
| 宏泰 Web current | `/opt/sfl/nodes/hbbtzn-l1/targets/web-api/releases/d32ee6f48f4091310f04f169453eb6bde271073b-86d68e369b4189f54d036b90d363404b3fde7d10cff79c36de762a8a6abc96a8-f939be7c22374ffda3c64154336414a194baaae4664295a1e37c3d28e0e6f1e0` |
| L0 Identity current | `/opt/zhudatuan/targets/identity-api/releases/seed-dc2889130e1fb7e85de6c92f9e867a3a33ba290749e6cb3c10be1d7f2496f68a` |
| L0 Web current | `/opt/zhudatuan/targets/web-api/releases/seed-7d3af0d4a8ed3ea303f13660b411b83056aeda10c00f09c614bc24dc48b81db1` |
| L0 Purchase current | `/opt/zhudatuan/targets/purchase-api/releases/seed-90a62c752229951d74294ef5fe43ecfed920937b7a768ff472ca2530778a5c8e` |
| L0 Support/Catalog/Webhook/Catalog Jobs/Payment Jobs | 尚无受管 `current`，第二批前必须逐项 seed |

所有只读状态查询时 node/target 锁均为空。Console 静态文件和指针不在候选改动内。

### 2.4 Caddy

第一批基线中 `/etc/caddy/Caddyfile` 的 SHA-256 为 `919f0b87a8ebf784f3c41a37a43cae62e1c6f28d10a2088004ddb5de63c65d60`。本任务未复制、覆盖或安装该文件，也未执行 Caddy reload。宏泰网关 node 指针及网关 MainPID 在本任务前后保持为 `0c02206d-console-senior-admin-v2` / `1444108`。

候选仅在仓库和 `agent-candidate` 临时目录中验证；没有写入活动网关配置。对当前配置和候选分别执行 `caddy adapt`，删除 Caddy 自动生成的 `group`/源路径元数据后，语义差异只有第 5 节所列路由，不涉及主 Caddyfile 中受保护的 9 个 `hbbtzn.com` 站点块。

## 3. 数据库关系与数据对账

### 3.1 为什么无需物理搬迁

源端 secret refs：

- `hbbtzn/nodes/l1/database/catalog-api`
- `hbbtzn/nodes/l1/database/web-api`
- `hbbtzn/nodes/l1/database/identity-api`
- `hbbtzn/nodes/l1/database/purchase-api`
- `hbbtzn/nodes/l1/database/payment-webhook-api`

目标 secret refs 为对应的 `zhudatuan/nodes/l0/database/*`。逐角色核对后，两组引用均解析到：

- PostgreSQL 地址：`172.18.0.2/32`（端点摘要均为 `3ce27a...`）
- 数据库：`zhudatuan_registration`
- 数据库 OID：`16384`
- 角色：Identity/Catalog=`zhudatuanidentityapi`，Web=`zhudatuanwebapi`，Purchase=`zhudatuanpurchaseapi`，Webhook=`zhudatuanpaymentwebhookapi`
- 迁移管理角色：`shopmigration`（ref：`zhudatuan/registration/database/migration`）

源/目标同角色 secret 值摘要逐对一致：Catalog/Identity=`438b0f...`、Web=`bf7531...`、Purchase=`bd4af5...`、Webhook=`a1e7d9...`。因此不存在“源库复制到目标库”的物理迁移；若再复制反而会在同一库内制造重复数据。第二批只需切服务和路由。

### 3.2 表级数量

| 域 | 数量 |
| --- | --- |
| Identity realm / entry / target / mallowner / org | 1 / 3 / 2 / 1 / 1 |
| Membership / membershiprole / member.profile | 13 / 26 / 12 |
| Catalog listing / sku / product / sourcelisting | 571 / 571 / 309 / 470 |
| Inventory stockitem / snapshot / movement / reservation | 571 / 1030 / 29 / 15 |
| Cart / cart items / checkout | 21 / 27 / 15 |
| Order record / lines / suborders / stateevents / aftersales | 1013 / 1015 / 13 / 0 / 100 |
| Payment intent / payment / capture / refund / refundcommand / refundtender | 13 / 4 / 4 / 0 / 0 / 0 |
| Fulfillment order / lines / milestones / returns | 4 / 4 / 0 / 0 |
| Support account / agent / conversation / ticket / message / assignment / history | 全部 0 |

关键状态分布：Listing 571 条全部 `published`；Stock 571 条全部 `active`；Membership 13 条全部 `active`。Order lifecycle 为 active=414、cancelled=40、completed=550、created=9；Payment state 为 authorizing=2、paid=924、partially_refunded=40、refunded=40、unpaid=7；Fulfillment state 为 allocated=54、cancelled=40、delivered=550、processing=80、returned=60、shipped=170、unallocated=59；Aftersales 为 completed=50、processing=25、requested=25。

金额对账：订单 `total_minor` 合计 14,180,876；售后金额 597,920；Payment intent 42,588；已落 Payment/Capture/Fulfillment 金额均为 5；退款相关表为空。

### 3.3 完整性与幂等

- 相关外键约束 160 条，`NOT VALID` 为 0。
- 对 Realm、Mall、Org、Membership、Catalog、Inventory、Cart、Checkout、Order、Payment、Fulfillment、Aftersales 的人工孤儿检查全部为 0。
- Payment intent、capture、refund、refundcommand、fulfillment 的幂等键重复组全部为 0。
- 相关范围表 RLS 已启用；策略数量包括 Membership=6、Cart=5、Listing=8、Checkout=5、Fulfillment=5、Realm=3、Stock=8、Order=6、Payment intent=6、Payment=5、Refund=3，以及 Support conversation/message/ticket 各 4。

## 4. 身份域保持独立

宏泰身份域记录为 `realm:l1`，`node_id=node:hbbtzn:l1`，`mall_id=mall:d1708f04df2dd8a61736852c4900fb43`，状态 active，类别 `operating_mall`。入口保持独立：`accounts.hbbtzn.com`→accounts、`api.hbbtzn.com`→api、`hbbtzn.com`→storefront；三个入口均 active。

Realm target 保留 admin/console/operator 与 consumer/storefront/storefront 两条映射；商城、组织与 owner scope 都是 `mall:d1708f04df2dd8a61736852c4900fb43`，owner 来源仍为 Ethan 的平台 owner membership。`identity.nodeprovisioning` 为 0 条不影响该结论，因为正式 realm/node 法定记录已存在。

`realm:l1` 的身份数据独立计数：account=12、linked principal=12、credential=12、session=191、auth ticket=191、challenge=34、challenge delivery=33、challenge secret=34、assurance=25、federated identity=4、login attempt=0、login intent=0。第二批不得复制、合并或重置这些凭据，只让共享 Identity 运行时按 Host/Realm 映射读取同一库中的 `realm:l1`。

## 5. 网关候选的精确语义差异

候选文件：`02_platform_pingtai/config/node-runtime/hbbtzn-l1/api-gateway.Caddyfile`。生成器带 `--omit-runtime-config` 可重复生成并通过 stale check，故候选没有额外增加 Identity/Console runtime JSON 路由。

| 匹配器 | 当前上游 → 候选上游 |
| --- | --- |
| Orders read preflight | `127.0.0.1:4432` → `127.0.0.1:4322` |
| Orders read | `127.0.0.1:4432` → `127.0.0.1:4322` |
| Storefront public catalog | `127.0.0.1:4432` → `127.0.0.1:4322` |
| Web business | `127.0.0.1:4432` → `127.0.0.1:4322` |
| Purchase write | `127.0.0.1:4434` → `127.0.0.1:4323` |
| Payment read | `127.0.0.1:4434` → `127.0.0.1:4323` |
| Catalog imports | `127.0.0.1:4431` → `127.0.0.1:4331` |
| Catalog batch | `127.0.0.1:4431` → `127.0.0.1:4331` |
| Catalog publication | `127.0.0.1:4431` → `127.0.0.1:4331` |
| Payment webhook | `127.0.0.1:4436` → `127.0.0.1:4326` |
| Identity fallback `/api/v1/*` | `127.0.0.1:4433` → `127.0.0.1:4321` |
| 新增 Support `/api/v1/support`、`/api/v1/support/*` | 无 → `127.0.0.1:4324` |

所有候选代理继续透传原始 Host 和 `X-Real-IP`，并删除 `X-Sfl-Node-Id`、`X-Sfl-Node-Manifest-Id`、`X-Sfl-Realm-Id`、`X-Zdt-Identity-Entry-Host`，不以网关头部伪造节点或身份域。

## 6. 候选验证结果

- JSON、Bash、Node 语法检查：通过。
- 发布计划测试：20/20 通过。
- 六服务受管计划：A2；目标为 Catalog、Identity、Payment Webhook、Purchase、Support、Web，托管去重后落到 `zhudatuan-l0`。
- 生产构建：通过；tests=10,146ms、typecheck=28,672ms、build=592ms、materialize=40ms、total=39,511ms。
- 计划：`.ai-delivery/runs/20260911200242-cb61a025-72e095ad/plan.json`
- 构建证据：`.ai-delivery/runs/20260911200242-cb61a025-72e095ad/build.json`
- 制品清单：`.ai-delivery/runs/20260911200242-cb61a025-72e095ad/package.json`
- Candidate Dry-run：通过；上传、候选激活、切流、重启均为 0。

## 7. 第二批上线前仍需完成

1. 处理远端分支已超上限的问题，并在 Ethan 明确批准后 push、开 PR；候选必须合并 `zdt-next` 且 CI 全绿后才能使用 Deploy 工作流。
2. 通过统一发布入口安装与合并提交一致的 agent/remote policy；不得使用本地未合并 SHA 直接生产切流。
3. 对 L0 缺失的 Support、Catalog、Payment Webhook、Catalog Jobs、Payment Jobs 指针逐项 seed；核对 Identity/Web/Purchase 现有 seed 是否仍是第二批的真实回滚点。
4. 安装 L0 与宏泰网关 runtime candidate，只允许 daemon reload，不启动或重启服务；逐项确认候选接受 `Host: api.hbbtzn.com`，不再返回 421。
5. 先逐项激活并验收六项共享服务，确认非目标 PID 不变；失败只回滚对应目标。
6. 再对活动网关配置制作可恢复备份，执行归一化 `caddy adapt` diff，确认只有第 5 节差异后，才通过受管工作流安装并 reload 网关。
7. 按部署前 15 域名基线逐行做外部验收；本机 Clash DNS 结果不能作为判据。Support 正确探针为 `/api/v1/support/cases`，未认证返回 401 可证明已命中路由，404/502 才是失败。
8. 稳定后才能停止旧宏泰 Catalog/Web/Identity/Purchase/Payment Webhook；不得停止 Identity notification jobs、Storefront、Gateway 或 Cloudflared。

第一批到此停止，等待 Ethan 批准第二批。
