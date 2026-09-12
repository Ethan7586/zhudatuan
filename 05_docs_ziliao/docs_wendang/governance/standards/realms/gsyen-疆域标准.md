---
realm_standard_id: REALM-GSYEN
中文名称: gsyen 疆域标准
version: '0.1.0'
status: REFERENCE
scope: 当前可从 gsyen-web 与 gsyen-api 版本库直接证明的 gsyen 本地边界
effective_at: '2026-09-12'
supersedes: null
authority: LAW.md → YC-GOV 1.0.0 → REALM-GOV 1.0.0
responsibility: 记录 gsyen 已证实标识、入口声明、身份与数据依赖以及 UNKNOWN
explicit_non_responsibilities: 推断经营主体、支付商户、品牌政策、SFL 节点级号、生产控制面或当前部署状态
---

# gsyen 疆域标准骨架 v0.1.0

状态：`REFERENCE`。本骨架未被 LAW 单独启用，不具有阻塞权；它只把直接证据与未知项分开。

## 1. 生效标准引用

| 标准 | 精确版本 | 用途 |
| --- | --- | --- |
| 雍彻科技治理标准 | `1.0.0` | 标准生命周期与权威 |
| SFL 核心标准 | `2.2.0` | 节点、Realm、Membership 与四流共同语义 |
| SFL 安全与运行完整性标准 | `1.0.0` | 身份、数据和运行结果保护 |
| 疆域标准 | `1.0.0` | 事实证据与 UNKNOWN 纪律 |
| 主打团标准 | 不适用 | gsyen 不是由现有证据证明的主打团商城疆域 |

## 2. 权威 SFL 标识

| 字段 | 值 | 证据状态 | 来源 | 观察时间 |
| --- | --- | --- | --- | --- |
| `realm_id` | `UNKNOWN` | `UNKNOWN` | 现有资料未声明 SFL Realm ID | 2026-09-12 |
| `mall_id` | `UNKNOWN` | `UNKNOWN` | 现有资料不能证明 gsyen 是商城 | 2026-09-12 |
| `operating_line_id` | `UNKNOWN` | `UNKNOWN` | 未见经营线权威记录 | 2026-09-12 |
| `operating_node_id` | `UNKNOWN` | `UNKNOWN` | 未见节点权威记录 | 2026-09-12 |
| `participant_realm_id` | `UNKNOWN` | `UNKNOWN` | 未见 SFL 参与者 Realm 记录 | 2026-09-12 |
| `participant_membership_id` | `UNKNOWN` | `UNKNOWN` | 未见 SFL Membership 记录 | 2026-09-12 |

## 3. 可直接证明的项目事实

| 事实 | 值 | 证据状态 | 来源 | 观察时间 |
| --- | --- | --- | --- | --- |
| Web 项目标识 | npm 包 `gsyen`，描述为 `GSYEN AI atelier workspace`，版本 `2.88.324` | `DECLARED` | `/Users/Ethan/Desktop/shurufa/gsyen-web/package.json` | 2026-09-12 |
| API 项目标识 | npm 包 `gsyen-api`，版本 `1.0.0` | `DECLARED` | `/Users/Ethan/Desktop/shurufa/gsyen-api/package.json` | 2026-09-12 |
| Web 公共入口声明 | `gsyen.com` | `DECLARED` | `gsyen-web/README.md` | 2026-09-12 |
| Web 允许来源声明 | `https://www.gsyen.com`、`https://gsyen.com` | `DECLARED` | `gsyen-api/.env.example` | 2026-09-12 |
| 分支入口声明 | `/branch` 重定向到 `https://branch.gsyen.com` | `DECLARED` | `gsyen-web/vercel.json` | 2026-09-12 |
| 邮件服务入口声明 | `https://mail-api.gsyen.com` | `DECLARED` | `gsyen-api/.env.example` | 2026-09-12 |
| 身份路径声明 | 浏览器经 `gsyen-api` 代理登录、注册与刷新，后端连接 Supabase Auth | `DECLARED` | `gsyen-api/AUTH.md` | 2026-09-12 |
| 数据平台声明 | Web 与 API 的示例配置均要求 Supabase URL；具体项目未知 | `DECLARED` | 两仓 `.env.example` | 2026-09-12 |
| API 运行平台声明 | 文档描述 gsyen-api 由 GitHub Actions 部署到 Cloud Run | `DECLARED` | `gsyen-api/AUTH.md` | 2026-09-12 |
| Web 运行平台声明 | 仓库存在 `vercel.json`；是否当前生产由 Vercel 承载未核验 | `DECLARED` | `gsyen-web/vercel.json` | 2026-09-12 |

以上仅证明仓库声明，不证明 2026-09-12 的 DNS、Cloud Run、Vercel、Supabase 或线上服务状态。

## 4. 本地适配与例外

当前没有足够证据把 gsyen 映射为某个 SFL 经营节点、商城、参与者 Membership 或主权层级，因此不登记本地 SFL 例外。未来接入时必须先取得第 2 节标识的权威值，再确定 Realm、身份代理和数据范围如何映射。

## 5. UNKNOWN

- 经营主体、公司法律名称、产权归属与负责人；
- 支付服务商、商户号、结算主体、币种与支付政策；
- 经 Ethan 确认的品牌政策和视觉规范权威版本；
- gsyen 是否属于某条 SFL 经营线、其级号、父节点、节点画像和主权层级；
- Supabase 项目标识、数据库位置、当前 Schema 与生产数据边界；
- Cloud Run 服务名、区域、当前 revision、Artifact Registry 制品；
- Vercel 项目、当前 deployment、DNS 与证书控制面；
- `gsyen.com`、`www.gsyen.com`、`branch.gsyen.com`、`mail-api.gsyen.com` 当前解析和可用状态；
- 恢复点、恢复时间目标以及真实恢复是否成功演练。

这些项目不得从 README、域名、npm 包名、示例环境变量或未提交代码推断。
