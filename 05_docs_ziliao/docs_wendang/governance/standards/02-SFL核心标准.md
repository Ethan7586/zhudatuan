---
standard_id: SFL-CORE
中文名称: SFL 核心标准
version: '2.2.0'
status: ACTIVE
scope: 共享内核、节点、经营线、Realm、Membership、层级、主权承载、四流与历史语义
effective_at: '2026-09-12'
supersedes: SFL 2.2 原文中的稳定业务宪法部分
authority: LAW.md → YC-GOV 1.0.0
responsibility: 定义所有疆域共同遵守的 SFL 稳定业务与架构语义
explicit_non_responsibilities: 安全控制等级、主打团产品流程、具体疆域事实、验收仪式、云地址、脚本与发布工具
---

# SFL 核心标准 v2.2.0

本标准承接桌面《四流合一 · 节点主权架构（SFL）标准 V2.2》中 Ethan 已确认的稳定业务宪法，并将安全、产品、疆域与运行事实拆回各自标准。它不继承 44 项验收仪式，也不声明任何实现或生产已符合。

## 1. 唯一职责与中立性

SFL（Sovereign Flow Lattice）是一套中立共享内核和共同语义，不是主打团、gsyen、某域名、某仓库或某个 L0 的别名。它负责回答：动作位于哪条经营线和哪个节点，使用哪份 Realm／Membership，谁是经营、供应和消费参与者，改变四流中的哪项事实，历史交易沿哪条路径解释。

本标准不规定认证实现、事务技术、制品工具、商城页面、品牌政策、云资源地址或项目特例；分别由安全、业务和疆域标准负责。

## 2. 共同术语

- **共享内核（Shared Core）**：所有节点共同引用的业务模型、公共契约与实现；节点差异不得形成长期平行内核。
- **经营线（Operating Line）**：由 `operating_line_id` 唯一标识、拥有独立 L0 参照点和相对级号空间的经营关系线。历史实现中的 `line_id` 只能作为兼容别名映射到同一概念，不能成为第二事实源。
- **节点（Node）**：由 `operating_node_id` 唯一标识的线内业务点。历史 `node_id` 只可作为边界别名。
- **Realm**：由 `realm_id` 标识，拥有账号、登录、恢复和会话生命周期的身份疆域。
- **Membership**：由 `membership_id` 标识，表达 Principal 在指定 Realm、节点与入口中的业务身份；凭据不是 Membership。
- **Session**：一次请求激活的一份 Membership 上下文。
- **节点画像（Node Profile）**：节点能做什么，例如经营商城或消费参与；它不定义节点级号、管理员角色或基础设施主权。
- **主权层级（Sovereignty Tier）**：`sovereign` 或 `hosted`，只回答节点是否拥有独立入口、资源绑定、运行实例和发布节奏。

## 3. L0—L11、唯一父级与多经营线

1. L0—L11 是同一类十二级会员节点；L0—L5 与 L6—L11 只是两个管理段，不是管理员／消费者两种身份。
2. 级号只表示节点在某一 `operating_line_id` 中的相对位置，不授予角色、权限、商城、后台或数据支配权。
3. 每条经营线有自己的 L0；同一主体可以在多条经营线、多个 Realm 中拥有独立节点和 Membership，不合并父链、级号、权限、Scope 或权益。
4. 在同一经营线和同一生效时段，一个节点只有一个 `parent_node_id`。关系换版必须保留原父边、新父边、生效时间和关系版本。
5. 无有效邀请时，当前 L0—L5 经营节点生成直属 L6；有效邀请只允许 L6→L7、L7→L8，依次至 L10→L11。邀请人节点是唯一直接父节点，不得跳级、双父或跨线借链。
6. SFL 2.2 不定义 L12；L11 邀请的结果保持未定义，任何实现不得自行选择新语义。
7. 管理员是独立管理身份，通过 Operation、Permission 与 Scope 工作，不属于任何 L 级；父子关系不自动产生管理权限。

## 4. 开店与能力升级

会员开店默认升级原节点能力，而不是生成无关新血缘。开店前后保持 `operating_node_id / operating_line_id / realm_id / parent_node_id / original_parent_node_id / signed_level / lineage / principal_id / membership_id` 及历史关系、路径和交易事实；新增 `mall_id`、经营能力和必要绑定。

节点可以是 `hosted × operating_mall`，也可以经显式迁移成为 `sovereign × operating_mall`。经营能力、线内级号和主权层级是三条正交轴，禁止相互推断。

## 5. 主权与承载

- **主权节点**：拥有独立公网入口链、Realm 绑定、资源绑定、运行实例、运行清单和发布指针。
- **承载节点**：在某主权节点基础设施内运行，以节点、Membership、权限与 Scope 数据区分；它不因此继承宿主的管理员身份、密钥、支付绑定或发布指针。
- 承载节点的创建、启停、标签和关系变化是节点事实变化，不是复制源码；共享内核变更不得按节点制造源码分支。
- `sovereignty_tier`、`node_profile`、`signed_level` 分别回答基础设施、能力、线内位置，不得合并为一个等级。

## 6. 身份上下文

节点账号、Credential、Principal、Membership、Session 必须分层表达。相同手机号、微信标识或其他凭据可以显式绑定多个 Realm 以便发现账号，但不授予任何节点权限，也不合并账号或会话。

一次请求只有一份活动 Membership，至少可判定：

```text
realm_id / account_id / principal_id / membership_id
surface / client
operating_line_id / operating_node_id / signed_level
sovereignty_tier / host_sovereign_node_id / mall_id / scope
credential_version / access_version
```

跨 Realm 切换必须由服务端明确建立目标 Realm 的会话；来源 Membership 的权限不得残留。

## 7. 四流与交易主体

SFL 的四流仅指：

- 订单流：购物车、结算、订单、取消、完成和售后关系；
- 商品流：商品、SKU、价格、库存、预占、履约、发货、收货、退货与回补；
- 现金流：支付意图、渠道受理、实收、退款与资金状态；
- 财务流：应收应付、账本、凭证、分配、结算、发票、对账与差异。

四流通过稳定业务标识、命令、查询和事件形成完整交易事实，但不共享权威写入权或状态机。一次销售交易有唯一经营所有者 `operating_node_id + mall_id`，可有多个供应商经济腿；消费参与者用 `participant_realm_id + participant_membership_id` 表达。

## 8. 有符号经营路径与历史

`signed_level` 表供需方向和线内相对位置，`sequence_no` 表真实执行顺序。`L-n` 是供给侧节点，不代表权限较低，也不能按数值排序。每个结算商品行冻结 `route_id / route_version / sequence_no / operating_line_id / operating_node_id / signed_level / supplier_id / contract_id / mall_id` 等实际路径事实。

层级、Owner、合同、供应关系或节点能力后来改变时，不得重算历史订单路径。退货、退款、库存回补和财务冲销按原商品行与供应商经济腿逆向回放；无法按原路执行时追加异常与改派事实，不覆盖原记录。

## 9. 核心规则登记

| 规则 ID | Owner | 职责范围 | 强制结果 | 真实损失 | 触发条件 | 执行点 | 例外／退出 | 来源证据 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CORE-001 | SFL Owner | 共享内核 | 节点共享同一内核语义，差异由节点事实表达 | 节点分叉后修复和交易语义漂移 | 新增节点或公共能力 | 架构与公共契约 | Ethan 升版 SFL | SFL 2.2 §2.5、§5 |
| CORE-002 | 层级 Owner | 经营线与父边 | 级号与父边必须绑定经营线；同一时段唯一父级 | 跨线错挂、双重归属、返佣或交易路径错误 | 创建／换版节点关系 | 层级事实写入 | 正式关系换版，历史保留 | SFL 2.2 §3.2 |
| CORE-003 | 身份 Owner | Realm／Membership | 同凭据跨 Realm／经营线身份独立 | 登录串号、权限和权益泄漏 | 注册、登录、切换身份 | 身份边界 | 用户明确切换后建立目标会话 | SFL 2.2 §3.2.1、§7 |
| CORE-004 | 节点 Owner | 开店 | 开店保留原节点与血缘，仅升级能力和必要主权资源 | 邀请关系、历史订单与会员资产丢失 | 会员开店或主权升级 | 节点／商城事实 | Ethan 定义新的迁移语义并升版 | SFL 2.2 §3.2.2 |
| CORE-005 | 授权 Owner | 权限边界 | 层级、级号和管理员角色不得相互推导权限 | 上级或管理员越权读取／写入成员数据 | 鉴权与管理操作 | Operation + Permission + Scope | 明确授权本身，不改变通用规则 | SFL 2.2 §2.1、§3.3 |
| CORE-006 | 交易 Owner | 四流所有权 | 四流分别持有自己的权威事实，只按稳定标识协作 | 订单、库存、支付或账本互相覆盖，无法对账 | 任一交易状态变化 | 对应业务流边界 | 无；纠错只能追加事实 | SFL 2.2 §11.1 |
| CORE-007 | 路径 Owner | 历史路径 | 商品行按 `sequence_no` 冻结路径，逆向按原路回放 | 退款、库存回补、结算落到错误主体 | 下单、履约、售后 | 路径快照与逆向编排 | 异常改派需追加留痕 | SFL 2.2 §2.4、§11.3—11.5 |
| CORE-008 | 标准 Owner | 未定义边界 | 未定义的 L12、业务名称和能力不得由实现猜测 | 不同实现创造冲突产品规则 | 遇到保留项 | 设计决策前 | Ethan 明确定义并升版 | SFL 2.2 §3.1—3.3 |

## 10. 明确排除

以下内容不属于本标准：SFL-01—39、SFL-D01—D05 的 44 项验收仪式；A0—A3 调度等级；当前阿里云 IP、域名、端口、数据库、systemd、Caddy、制品路径；具体脚本、生成器和发布工具。它们分别是证据、调度参考或可变运行事实。

## 11. 引用

- 治理上级：[`雍彻科技治理标准 1.0.0`](01-雍彻科技治理标准.md)
- 结果保护：[`SFL 安全与运行完整性标准 1.0.0`](03-SFL安全与运行完整性标准.md)
- 主打团产品：[`主打团标准 1.0.0`](04-主打团标准.md)
- 本地适配：[`疆域标准 1.0.0`](05-疆域标准.md)
- 来源证据：`/Users/Ethan/Desktop/14-SFL-四流合一节点主权架构标准 V2.2.md`，仅作来源追溯
