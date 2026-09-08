---
title: '四流合一 · 节点主权架构（SFL）标准'
english_name: 'Sovereign Flow Lattice'
abbreviation: 'SFL'
version: 'SFL 1.6'
status: '正式架构标准'
date: '2026-09-08'
owner: 'Ethan'
canonical_path: '05_docs_ziliao/docs_wendang/architecture/10-SFL-四流合一节点主权架构标准 V1.6.md'
normative_base: '05_docs_ziliao/docs_wendang/architecture/08-SFL-四流合一节点主权架构标准 V1.5.md'
normative_base_sha256: 'fd050004ace1f126790c9927311aa22e5010ea2343a106f0e71f891675afc88d'
---

# 四流合一 · 节点主权架构（SFL）标准 V1.6

> 核心表述：**一套共享商城内核，节点各自拥有完整公网入口与运行边界；任何跨节点行为必须由当前节点主动申请、目标节点独立校验，失败时关闭而不借道。**

## 0. 版本关系与权威范围

SFL 1.6 完整继承 SFL 1.5 的术语、节点分段、有符号经营路径、四流事实、身份模型、功能与权限、A/B/C/D、NodeManifest、发布及 SFL-01—24、SFL-D01—D04。上方固定的 SHA-256 是被继承基线的完整性标识；V1.5 文件保持原样，作为可审计历史版本。

本版新增两项规范性能力：

1. **域名主权（Domain Sovereignty）**：节点必须拥有从公网域名到节点本地进程的完整独立入口链；
2. **主动跨节点授权（Active Cross-Node Authorization）**：跨节点只能由来源节点根据用户明确动作签发一次性意图，再由目标节点独立完成身份闭环。

若本文件与 SFL 1.5 对域名、入口、代理、共享运行进程或跨节点切换的表述冲突，以本文件为准；未明确修改的 SFL 1.5 条款继续具有完整规范效力。

## 1. 新增权威术语

| 中文主名 | 英文规范名 | SFL 1.6 含义 |
| --- | --- | --- |
| 域名主权 | Domain Sovereignty | 一个节点独立拥有公网主机名、边缘绑定、隧道绑定、节点本地网关和源站进程的完整链路 |
| 节点公网 API | Sovereign Node API | 仅代表一个节点、由该节点 NodeManifest 声明且不能代理到另一节点 API 的公网 API 主机名 |
| 节点边缘绑定 | Node Edge Binding | 公网主机名到该节点专属边缘路由／隧道的版本化绑定 |
| 节点本地网关 | Node-Local Gateway | 仅消费一个 NodeManifest、按方法和路径分发至本节点进程并保留原始 Host 的本地入口 |
| 主动跨节点授权 | Active Cross-Node Authorization | 来源节点在用户明确选择后主动签发、目标节点独立消费的短时一次性授权流程 |
| 关闭式失败 | Fail-Closed Failure | 当前节点入口不可用时直接失败，不改走父节点、兄弟节点、旧代理或默认源站 |
| 跨节点借道 | Cross-Node Borrowing | 使用其他节点的域名、边缘路由、源站、进程身份、会话、密钥、支付绑定、回调或发布指针承载当前节点请求；SFL 1.6 禁止此行为 |
| 跨节点授权凭证 | Cross-Node Grant | 未来用于非登录业务协作的显式授权凭证；本版只保留概念位置，不定义合同、不允许实现或推断 |

## 2. 域名主权

### 2.1 完整入口链

每个运行节点必须形成且只能形成自己的入口链：

```text
节点自有公网主机名
→ 节点自有边缘路由
→ 节点自有隧道及凭据
→ 节点本地 TLS 网关
→ 节点自有运行进程
→ 节点自有资源绑定与数据范围
```

链中每一跳都必须能恢复同一个 `node_id + manifest_id + manifest_digest + runtime_instance_id`。公网 Host 必须精确命中 NodeManifest 的域名绑定；未知 Host、重复归属、Host 与运行清单不一致均须在进入业务处理前拒绝。

一个节点的公网 API 不能以另一节点的 API 主机名、请求头、路径前缀或内容改写来“声明自己”。`Host` 是入口选择的直接证据；`x-sfl-node-id`、`x-sfl-node-manifest-id`、历史节点头或前端提交的 `node_id` 只能被忽略或清除，不能覆盖服务端解析结果。

### 2.2 节点本地网关

节点本地网关必须：

1. 只加载一个目标节点的 NodeManifest 和运行端口映射；
2. 以请求方法和路径选择本节点进程，不以品牌名、来源节点或自报节点头选择；
3. 向上游保留原始 Host；本地 TLS 场景同时保持与 Host 一致的 SNI；
4. 清除可伪造节点身份的入站头；
5. 对未知 Host 返回明确拒绝，不执行默认代理；
6. 不包含其他节点的域名、上游地址、回退目标或内容替换规则；
7. 健康检查、日志和就绪证据必须携带本节点 Manifest 标识。

### 2.3 禁止的跨节点借道

以下行为全部禁止：

- L1 请求先进入 L0 公网 API，再用请求头、路径或内容改写转回 L1；
- Worker、反向代理或 CDN 把当前节点请求发送到另一节点源站；
- 当前节点隧道失效后自动回退至父节点或共享默认源站；
- 使用另一节点的登录会话、Cookie、身份进程配置、密钥、支付商户／应用、APIv3 密钥、通知地址或发布指针；
- 在 HTML、JavaScript、JSON、重定向或响应头中把另一节点内容替换成本节点品牌后继续提供服务；
- 通过裸 `target`、裸 `application`、未经绑定的 Host、Cookie 存在或重试行为推断跨节点许可。

### 2.4 关闭式失败

节点边缘路由、隧道、本地网关、目标进程或节点资源绑定不可用时，该节点必须直接失败。任何自动借道即为 SFL-25 `FAIL`，即便页面看起来仍可访问。

关闭式失败必须用受控演练证明：停止目标节点隧道或网关后，目标域名失败；对照节点保持原状态；目标请求不会出现在对照节点的接入日志、业务日志或交易事实中。

### 2.5 同机部署不等于共享节点

L0 与 L1 可以位于同一物理 ECS，也可以共享源码、不可变制品、数据库集群和通用实现，但必须分别拥有：

```text
public_api_host
edge_binding_ref / tunnel_id / tunnel_credential_ref
gateway_runtime_id / gateway_port
identity_runtime_id / identity_port / identity_config_ref
purchase_runtime_id / purchase_port / purchase_config_ref
payment_webhook_runtime_id / webhook_port / webhook_config_ref
payment_jobs_runtime_id / job_scope / job_config_ref
realm_ref / data_scope_ref
secret_binding_set_ref
payment_binding_refs / callback_binding_refs
release_pointer_ref
```

同一物理进程不得同时以 L0、L1 两个运行实例身份对外服务。相同可执行文件可以启动为多个独立进程，但每个进程只能加载一份 NodeManifest、一组节点配置和一个发布指针。后台任务领取业务作业时必须带节点数据范围，不允许按全局任务类型抢占另一节点作业。

## 3. 主动跨节点授权

### 3.1 默认节点内闭环

浏览、注册、登录、恢复、建会话、购买、支付、回调和订单查询默认只在入口 Host 所属节点闭环。没有显式跨节点授权时，任何请求只能继续使用当前节点上下文或被拒绝。

来源节点不能把自己的有效会话改写成目标节点会话；目标节点也不能因为来源 Cookie、相同手机号、相同微信标识、共同 Principal 或父子关系而自动建立账号、Membership、Session、Permission 或 Scope。

### 3.2 登录意图

跨节点登录必须由用户明确选择目标后，通过来源节点已认证会话主动请求。来源节点服务端签发短时、一次性的 Login Intent，至少冻结：

```text
intent_id / intent_version / token_hash
source_realm_id / source_node_id / source_account_id / source_session_id
target_realm_id / target_node_id / target_surface / target_application
target_accounts_binding_ref / target_return_binding_ref
issued_at / expires_at / consumed_at / nonce
target_account_id / target_session_id（消费后）
```

登录意图必须满足：

1. 来源会话有效，来源 Realm 与服务端解析的来源 NodeManifest 一致；
2. 目标节点、入口、应用、账号域与返回地址全部来自目标 NodeManifest／版本化绑定，不接受调用方自报 URL；
3. 跳转后浏览器进入目标节点自己的账号域和 API 域，不经过来源节点 API；
4. 有效期默认不超过五分钟；只允许原子消费一次；
5. 过期、重放、错误目标 Realm、错误目标入口、错误应用、错误目标账号或错误目标会话全部拒绝；
6. 消费成功只建立目标 Realm 内的账号、Membership 和 Session，不携带来源权限与 Scope；
7. 签发、消费、拒绝和结果均按来源与目标节点留存审计证据。

### 3.3 主动申请不等于被动借道

“跨节点只能主动申请”同时约束发起者和承载链路：

- 只有已认证来源节点可以签发意图；目标节点不能被来源请求自动命中；
- 只有用户明确动作可以触发签发；重试、跳转、Cookie、Referer、品牌或父子关系不能触发；
- 目标节点只消费与自身 Host、Realm、Surface、Application 相符的意图；
- Login Intent 只解决身份进入，不授予订单、支付、治理或数据访问能力。

### 3.4 Cross-Node Grant 保留项

未来如需跨节点治理、库存协作、结算或其他业务协作，必须另行提升 SFL 版本并定义 Cross-Node Grant 的签发主体、目标 Operation、Scope、资源、期限、一次性／可撤销语义、审计和失败边界。

SFL 1.6 不存在通用 Cross-Node Grant。任何代码不得把 Login Intent 扩展解释为业务授权，也不得以“未来会补”为由加入自动代理、默认回落或跨节点资源读取。

## 4. A/B/C/D 边界补充

SFL 1.5 的 A/B/C/D 继续有效，并增加以下判定：

| 类别 | SFL 1.6 补充内容 |
| --- | --- |
| A 共享商城内核 | 可共享网关生成器、身份／购买／支付实现和进程入口；不得写入实例域名、跨节点回退或品牌分支 |
| B NodeManifest | 必须声明节点自有公网 API、账号／后台／前台域名及资源引用；域名归属全局唯一 |
| C 节点资源绑定 | 必须包含边缘／隧道、网关、独立进程、Realm、Scope、密钥、支付、回调、作业范围和发布指针 |
| D 历史兼容层 | 跨节点 Worker、L0 API 头路由、内容改写和域名猜测均属于 D；目标节点仍有任一生产流量依赖即不能退出 |

D 类退出必须同时证明：生产路由绑定为零、目标代码不再转发、目标域名只进入本节点链路、受控停止演练不借道、回滚快照可恢复原状态。仅把 Worker 代码改成 `410` 而未解除生产路由，不算退出。

## 5. 新增符合性闸门

| 编号 | 直接测量目标 | 验证方式与必需证据 | `PASS / FAIL` 边界 |
| --- | --- | --- | --- |
| SFL-25 | 节点域名主权 | 对每个目标节点读取 DNS／边缘路由、隧道 ID 与凭据引用、本地网关、Host/SNI、进程端口、NodeManifest、资源与发布指针；执行错误 Host、伪造节点头和停止目标隧道／网关的隔离演练 | 每个 Host 只进入自身链路，节点头不能改写归属，停止目标链路只令目标失败且对照节点零变化为 PASS；出现跨节点源站、内容改写、默认回落、共享运行身份或失败后借道为 FAIL |
| SFL-26 | 主动跨节点授权 | 执行节点内登录、无意图跨节点、合法 Login Intent、过期、重放、错误 Realm／Surface／Application／Account／Session 对照；核对浏览器进入目标自有域、目标会话和权限残留 | 只有用户明确动作签发的短时一次性意图可建立目标节点会话，且来源权限／Scope 零残留为 PASS；裸值、Cookie、重试、父子关系或被动代理可触发跨节点身份／业务访问为 FAIL |

SFL 1.6 的完整必测集合为：`SFL-01`—`SFL-26` 与 `SFL-D01`—`SFL-D04`，共 30 项。单项只允许 `PASS / FAIL / UNKNOWN / N/A`；任一必测项 `FAIL` 即总体不符合，存在 `UNKNOWN` 即总体只能报告部分符合，全部必测项 `PASS` 才能报告完整符合。

本批实例的完整逐项状态、证据类型和生产缺口必须放入日期化证据矩阵，不在标准正文中写死当前完成度。

## 6. 首轮 L0／L1 实例映射（非规范性）

当前首轮实例仅用于验收通用标准：

```text
node:zhudatuan:l0
  public API: api.zhudatuan.com

node:hbbtzn:l1
  public API: api.hbbtzn.com
  dedicated tunnel → local TLS gateway → L1-only processes
```

`api.hbbtzn.com` 不得经过 `api.zhudatuan.com`；`hbbtzn` 请求不得由历史 Worker 转发至主打团上游后改写。两个节点同机运行时，身份、购买、支付回调和支付任务仍必须分别启动、分别绑定 Manifest 与配置，并能独立停止和恢复。

任何未来备用域名均须先形成独立版本化域名绑定并经过 SFL-25 验收；未登记的备用域名不是自动回退目标，也不得替换现有节点身份。

## 7. 发布与验收顺序

域名主权切换必须按以下顺序执行：

```text
冻结 DNS、Worker 路由、隧道、网关、进程、发布指针及对照节点基线
→ 发布不可变候选，不切流
→ 启动本节点独立进程和本地网关
→ 本地 Host/SNI 与方法／路径矩阵验收
→ 创建／绑定本节点专属隧道
→ 解除历史 Worker 路由
→ 外部执行登录、购买、支付／回调、订单及隔离验收
→ 停止目标隧道或网关，证明关闭式失败且对照节点不变
→ 恢复目标链路并复验
→ 固化机器证据与回滚快照
```

Cloudflare、DNS、隧道或生产配置变更前必须展示精确前后差异和回滚操作。生产证据未完成时只能报告“候选完成”，不得把静态配置、单元测试或本地构建记作生产 PASS。

## 8. 变更记录

| 版本 | 日期 | 状态 | 变更 |
| --- | --- | --- | --- |
| SFL 1.6 | 2026-09-08 | 正式成文 | 在完整继承 SFL 1.5 的基础上增加域名主权、节点本地网关、关闭式失败、独立身份／购买／支付进程、主动跨节点授权与 Login Intent 强约束；新增 SFL-25、SFL-26，并明确 Cross-Node Grant 尚未定义 |
| SFL 1.5 | 2026-09-07 | 历史正式版本 | 一次构建、多节点运行、独立发布指针、节点支付 7/7、D 类退出及 SFL-01—24／D01—D04 |
