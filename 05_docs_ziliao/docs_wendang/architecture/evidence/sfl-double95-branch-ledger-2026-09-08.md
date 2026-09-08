# SFL 1.6 双95分支成果账本｜2026-09-08

状态：本地候选收口完成，尚未部署。本文记录来源与去向，不授权删除任何远程分支。

## 1. 权威主轴与治理边界

- 唯一主轴：`origin/zdt-next`
- 开工 SHA：`a0bbf4c8a16a264ac2481b3fbf778bf486e1439a`
- 收敛前候选 SHA：`9916543b9daee987d4b272fad0c9817a30e6225f`
- 本次工作分支：`fix/sfl-double95-convergence`
- GitHub 远程分支：8 / 12
- 分支数量不计分；删除分支不加分。
- 删除任何远程分支前，仍须 Ethan 单独确认精确分支名、SHA、承接证据与保留位置。

## 2. GitHub 远程分支

| 分支 | 取证 SHA | 相对主轴 | 初步分类 | 当前去向 |
| --- | --- | --- | --- | --- |
| `zdt-next` | `a0bbf4c8a16a264ac2481b3fbf778bf486e1439a` | 权威基线 | 已在主轴 | 本次唯一合并目标 |
| `integration/Winston` | `5ecc2a6bd907932d47ed4e48bf2ba05d5114acb0` | 主轴后代已完整包含，零独有提交 | 已在主轴 | 保留，等待 Ethan 后续裁决 |
| `zdt-beta` | `b255d959c2f959a679b4addfc2db9727b50e1eae` | 主轴后代已完整包含，零独有提交 | 已在主轴 | 保留，等待 Ethan 后续裁决 |
| `zdt-internal` | `5eb958e56dea7a03e0683f85f83c8351e0b9c50a` | 主轴后代已完整包含，零独有提交 | 已在主轴 | 保留，等待 Ethan 后续裁决 |
| `feature/order-management-list` | `9651dbb7df2ad3990d60f6da5a7e269231649503` | 主轴之上 6 个订单/H5 独有提交 | 本任务范围外，独立保留 | 不因双95任务盲合或删除 |
| `feature/sfl-standard` | `b701a536dac90002300adbdc505045dc69bd9bb9` | 与当前主轴分叉，含 5 个 SFL 标准提交 | 应选择性承接 | 承接权威 SFL 1.5 标准及必要引用，排除无关视觉资产变化 |
| `backend-reconstruction` | `8105104c5ccc1db38b43bb1ec76d2825ba81d7dd` | 与新系统主轴无共同祖先，旧目录结构，98 个独有提交 | 仅作历史证据保留 | 禁止整支合入新系统；按能力另行迁移 |
| `zdt-history` | `c36a8f917174d1bcb9d4f8d6328d14fe149a2a26` | 与新系统主轴无共同祖先，旧目录结构，46 个独有提交 | 仅作历史证据保留 | 禁止整支合入新系统 |

## 3. 本地未推送的重要成果

这些成果不在 8 条 GitHub 分支清单中，但含独有提交，必须纳入本次取证，不能因“只看远程”而遗漏。

| 本地分支 | 取证 SHA | 独有成果 | 初步分类 | 当前去向 |
| --- | --- | --- | --- | --- |
| `feature/sfl-node-kernel` | `09047f5745921062a0c9291cc8991bfbfd3a3c7d` | SFL NodeManifest/NodeContext、Console 同源制品、服务端上下文、入口去串线 | 应选择性承接 | 作为统一节点内核候选；需与身份、商品两套 Manifest 合一 |
| `fix/sfl-identity-node-profiles` | `2256f09da1e2070cea4e4d1de70031b587ef33f2` | 身份域五批、受管迁移、凭据/会话/验证隔离、百人并发、L1 运行边界 | 应选择性承接 | 身份业务事实候选；不得保留第二套独立节点清单来源 |
| `feature/sfl-catalog-flow` | `a706b0819935a5036f6781f3724b656a9cb9b176` | L1 商品、库存、订单、媒体、运行资源隔离与独立部署 | 应选择性承接 | 商品业务事实候选；其 NodeManifest 必须并入统一内核 |
| `fix/hbbtzn-login-scope` | `017c8ec2f3c1107718d29ffcefaa44f4203b837f` | 基于商品节点线追加两项 L1 登录会员范围修复 | 应选择性承接 | 仅承接两项身份范围增量，避免重复承接商品祖先提交 |
| `fix/storefront-navigation-cart-experience` | `225d8e98e9a89f39d2c1affb250d4c0991d8c548` | H5 动效与导航体验 | 本任务范围外，独立保留 | 不因双95任务盲合或删除 |
| `codex/mall-six-layer` | `6c6f2f6f101520d57d1c686b50c9f45cea0eadd0` | 六层目录骨架 | 已被主轴等价承接 | 零新增承接 |
| `codex/partner-six-layer` | `e16ed07ec101a669282fba287d16b2f922d10836` | 六层目录骨架 | 已被主轴等价承接 | 零新增承接 |
| `codex/verification-six-layer` | `e1763169abdc2d7ec19396d40c741d1db5c8c28e` | 六层目录骨架 | 已被主轴等价承接 | 零新增承接 |

## 4. 已确认的全局冲突

第一轮取证已发现三套相互独立的节点清单实现：

1. `SflNodeKernel.ts`：字段最完整，包含版本化引用、摘要、发布指针和 L0—L11 夹具，但生产清单主要偏 Console。
2. `IdentityNodeManifest.ts`：覆盖生产 L0/L1 登录入口和目标，但另设 `defaultNodeId`，并形成身份专用来源真相。
3. `NodeManifest.ts`：覆盖商品、库存、订单和生产域名，但又定义一套不同 schema 与引用格式。

这三套实现不能原样同时进入主轴。最终必须形成一个权威 NodeManifest/NodeContext 内核；身份、商品、订单和 Console 只能消费该内核或其有类型的投影，不能各自维护节点真相。

## 5. 主工作区未提交成果

`/Users/Ethan/Desktop/zdt-next` 在开工时包含身份、商城、订单、密码规则、文档和基础设施等未提交变化。它们属于 Ethan/既有任务，本任务不覆盖、不回退、不提交。完成候选收口前，将按文件和补丁等价性核对是否已有成果尚未进入任何不可变提交；无法判断的项目标记 `UNKNOWN` 并交 Ethan 裁决。

## 6. 本批收敛结果

- 形成唯一 SFL 1.6 节点注册表与生成式 NodeManifest；身份、商品、订单、支付只消费同一节点事实源。
- L1 候选拓扑改为独立 Tunnel、节点本地 TLS Gateway、独立 Identity/Purchase/Payment 进程；不再设计跨节点 Host、Origin 或内容改写。
- `hbbtzn-alias` Worker 候选已退役为 `410` 哨兵，路由声明为空；生产 Worker 与 DNS 尚未改动。
- 跨节点身份只允许显式、短期、一次性 Login Intent；裸目标、Cookie、重试和默认回退均不能建立跨节点授权。
- 建立 SFL-01—26、D01—D04 共 30 项双层矩阵，候选状态与生产状态分列，禁止用本地候选冒充生产通过。
- 候选定向测试、全量单元测试、类型检查、迁移回放、身份域隔离、生成物校验、SFL 符合性门禁和带正式环境变量的生产构建均已通过。
- 全局 Provider Contract 仍受既有 Cakeuncle 测试配置缺失影响；该问题不属于本批 SFL 改动，但在正式发版前仍需单独处理或给出既有基线豁免证据。
- 未修改 Cloudflare、生产主机、生产 Caddy、DNS、Tunnel、服务或数据库；生产矩阵仍有 `SFL-23`、`SFL-25` 两项明确失败，不能宣称已经部署完成。

## 7. 后续更新规则

- 每次承接必须补：来源提交、目标提交、关键文件、验证结果。
- 运行期间远程 SHA 移动时记录新旧 SHA，不覆盖历史记录。
- 最终报告列出所有仍保留分支，不执行分支删除。
