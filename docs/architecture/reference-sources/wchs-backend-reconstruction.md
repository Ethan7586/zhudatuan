# WCHS 参考源：backend-reconstruction

> 建立时间：2026-09-02
> 性质：隔离学习副本，不是 `zdt-next` 主轴
<<<<<<< HEAD
> 状态：已建立、已锁定基线、禁止推送、自动下拉
=======
> 状态：已建立、已锁定基线、禁止推送
>>>>>>> 21342f2c (docs(architecture): register wchs reference source)

## 一、来源身份

| 字段 | 值 |
|---|---|
| GitHub 仓库 | `Ethan7586/zhudatuan` |
| 来源远程分支 | `backend-reconstruction` |
| 固定来源 SHA | `2ebf2ed91e872b134b915b7db67e12cf2d35f0ff` |
| 提交标题 | `acceptance report` |
| 提交作者 | `JohnsonWiki <311676872+JohnsonWiki@users.noreply.github.com>` |
| 提交时间 | `2026-09-01T23:06:52+08:00` |
| 本地目录 | `/Users/Ethan/Desktop/zdt-next/wchs` |
| 本地分支 | `wchs` |
| 初始大小 | `115M` |
| 受管文件数 | 3,557 |

`wchs` 是对朋友架构的本地学习名称。它不替代 `zdt-next`，也不自动获得合并资格。

## 二、隔离方式

该目录是独立的单分支克隆，只抓取：

```text
+refs/heads/backend-reconstruction:refs/remotes/origin/backend-reconstruction
```

隔离规则如下：

1. `zdt-next` 父仓库通过本地 `.git/info/exclude` 忽略 `/wchs/`。
2. `wchs` 有自己的 `.git`、索引、工作区和本地分支。
3. 抓取地址仍指向 GitHub，方便读取朋友后续提交。
4. 推送地址设置为 `disabled://backend-reconstruction-read-only`。
5. `push.default` 设置为 `nothing`。
6. 普通推送与显式推送的 dry-run 均以退出码 `128` 被拒绝。
7. 建立过程没有修改 GitHub 的 `backend-reconstruction`，也没有改变远程分支总数。

这允许在 `wchs` 内做本地实验，同时避免误推到朋友的远程分支。

## 三、初步结构图

```text
wchs
├── apps
│   ├── auth
│   ├── console
│   └── storefront
├── services
│   └── commerce
├── packages
│   ├── authz
│   ├── config
│   ├── contract
│   ├── design
│   ├── kernel
│   ├── sdk
│   ├── telemetry
│   └── testing
├── extensions
│   ├── channel
│   ├── notification
│   └── payment
├── database
├── infrastructure
├── runbooks
├── tests
└── tools
```

这是一个“应用层 + 单体业务服务 + 共享内核包 + 外部扩展”的工作区结构。

## 四、第一轮值得学习的部分

以下是初步观察，只代表值得深入审阅，不代表已经批准迁入 `zdt-next`。

### 1. 明确的业务模块目录

`services/commerce/src/test/architecture/ModuleCatalog.test.ts` 固定检查：

- 29 个业务模块和支持模块目录。
- 每个契约操作必须归属一个已声明模块。
- 模块依赖必须指向真实模块。
- HTTP 方法与路径组合不得重复。

可取之处是把“模块边界是否完整”变成可执行检查，而不是只画架构图。

### 2. 高风险规则放进领域测试

`DomainPolicy.test.ts` 集中覆盖结算版本、财务平衡、退款上限、库存终态、订单状态、优惠券状态、风险优先级和通知模板等规则。

可取之处是核心业务不变量拥有直接测试，不依赖页面或接口失败来间接证明。

### 3. 共享能力分层

`contract`、`kernel`、`sdk`、`authz`、`telemetry` 和 `testing` 被拆成独立包。

值得学习的是“契约、领域基础、调用 SDK、授权、观测、测试工具”之间的职责命名；是否采用其实现，需要逐包检查依赖方向和生产适配程度。

### 4. 外部能力使用扩展目录

渠道、通知和支付位于独立 `extensions/`：

| 扩展类别 | 当前受管文件数 |
|---|---:|
| channel | 243 |
| notification | 22 |
| payment | 18 |

方向上适合参考“核心业务定义端口，供应商适配放外围”；但 `channel` 的规模已经较大，不能仅凭目录名称判断边界健康。

### 5. 验证入口较完整

根工作区提供 unit、contract、integration、component、e2e、journey、security、performance、SQL 以及 architecture audit 等入口。

值得学习的是验证层次的命名和覆盖范围；闸门数量与维护成本必须重新评估，不能整套照搬。

## 五、暂不照搬的部分

1. 该副本有 3,557 个受管文件，并跟踪 `.tmp`、`evidence`、`outputs` 等目录，整体导入会把旧系统体积带进新主轴。
2. 大量 `check:*` 和审计脚本可能同时包含有效约束与历史负担，需要按生产问题逐项证明价值。
3. 朋友分支不是阿里云运行真值；生产架构仍以现网进程、路由、数据库和发布物反推结果为准。
4. 不执行整分支 merge，不批量 cherry-pick，也不直接复制数据库迁移。

## 六、学习与吸收方法

每次只选择一个模式：

1. 明确它解决的具体问题。
2. 找到对应源码、测试和依赖边界。
3. 与阿里云运行真值及 `zdt-next` 目标架构比较。
4. 写一条小型架构决策记录。
5. 在 `zdt-next` 重新实现最小版本，而不是搬运整段历史。
6. 独立验证通过后，才进入共享主轴。

## 七、与分支收窄的关系

- `backend-reconstruction` 当前标记为“参考源，暂缓关闭”。
- `wchs` 只是本地名称，不新增 GitHub 分支。
- 它不会阻止继续逐条收窄其他远程分支。
- 是否关闭远程 `backend-reconstruction`，必须等学习取证结束并另行获得 Ethan 授权。

<<<<<<< HEAD
## 八、自动下拉规则

Codex 自动化 `同步 WCHS 参考分支` 已启用，自动化 ID 为 `wchs`。

| 字段 | 值 |
|---|---|
| 检查频率 | 每 72 小时一次 |
| 远端来源 | `origin/backend-reconstruction` |
| 本地目标 | `wchs` |
| 合并模式 | fast-forward only |
| 推送 | 永久禁止 |
| 首次同步核验 | `2026-09-02T00:46:44+08:00` |

每次检查必须按以下顺序执行：

1. 确认当前分支仍为 `wchs`。
2. 确认工作区干净。
3. 确认 `push.default=nothing`，且推送地址仍为禁用协议。
4. 只抓取 `backend-reconstruction`，不抓取其他分支和标签。
5. 只有本地 HEAD 是远端祖先时，才执行 fast-forward 更新。
6. 无新提交时不修改任何文件。
7. 出现本地改动、历史分叉、配置保护丢失或抓取失败时，只报告，不覆盖、不重置、不提交、不推送。

因此，朋友提交后会在下一个 72 小时检查周期自动下拉；自动化不会修改 `zdt-next` 主轴或阿里云。
=======
>>>>>>> 21342f2c (docs(architecture): register wchs reference source)
