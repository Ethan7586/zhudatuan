# LAW

Ethan 的硬法。任何会话、任何 agent 必须遵守。看到违反，改回来。
本文件与 CLAUDE.md / AGENTS.md 冲突时，**以本文件为准**。

## 1 · 生产端 / 部署端：严禁任何验证（核心的核心）

- **生产端、部署端禁止用验证码、密码、授权 token、审批码、口令、二次确认、"你确定吗"。凡是这样的验证，全禁止。**
- 部署代码 / 发布工具里**不允许**新增：门禁、验证、守卫、断言、校验、权限收窄、RLS、限流、登录锁定、冷却。
- **看到已存在的这类东西，直接删。**
- 部署授权 = Ethan 敲命令 / 跑脚本这个动作本身。不要 `--approve-production`、不要"回复开始部署"、不要 GitHub Environment 审批。
- 安全约束只由 Ethan 亲手加。会话只报告风险，不实施。
- （**终端用户**的登录密码和手机验证码是产品功能，归 CLAUDE.md 一，不在本条。本条只管生产 / 部署工具链。）
- 「以后我的代码，所有的这些，生产的时候全删除。」——Ethan

## 2 · 部署 = 传 Dropbox

部署就是：本地 `build` → `rsync` dist 到生产出文件目录。结束。

- 没有「指针 / 候选 / current / previous / seed / 接线 / productionEnabled / --environment production / 发布引擎 / A3 / 分级」。看到当它不存在。
- `console.hbbtzn.com`：`rsync 01_core_hexin/apps/console/dist/ → root@123.57.232.253:/opt/sfl/nodes/hbbtzn-l1/current/01_core_hexin/apps/console/dist/`，不重启。
- `accounts.hbbtzn.com`：同上，换 `auth-web/dist`。
- 后端服务：`rsync` 编译好的 JS + `systemctl restart sfl-<service>@hbbtzn-l1`。
- 部署阶段不跑测试、不构建、不浏览器验收、不打域名基线、不做 caddy diff、不取证。
- 代价（接受）：没有回滚点、没有原子切换。传坏了再 build 一个好的传回去。

## 3 · 会话之间不互传信息

- 会话不能把上下文 / 结论 / 指令直接传给另一个会话。
- 一切经过 Ethan 统一。不得根据另一个会话的报告直接开工，以 Ethan 在对话里的话为准。

## 4 · 会话的活到哪为止

- 到「合并进 `zdt-next` 且 CI 绿」为止。
- 不在本地 `npm install` / build / test / package / deploy，不做浏览器 QA。
- 部署是 Ethan 自己 `rsync`（或 `scripts/裸传.sh`）。

## 5 · 校验只在 PR / CI 跑一次

- 只跑改动相关的定向测试 + typecheck。不跑全量回归。
- CI 绿 = 可合。合完就完事。

## 6 · 下面这些不是代码失败，是环境 / 流程摩擦——别慌，别过度反应

会话反复撞这几条，每次都当成"测试失败 / 部署失败"，其实一个代码 bug 都没有：

| 现象 | 真实例子 | 它到底是什么 | 怎么办 |
|---|---|---|---|
| 隔离 worktree 没依赖 | "隔离工作区没有依赖，环境缺失不是代码失败" | 每次 `git worktree add` 都缺 `node_modules` | 复用主项目 `node_modules`；不行才 `npm ci`。别当失败报告。 |
| 复用旧依赖版本错位 | "主项目依赖比最新 zdt-next 少一个配置入口" | 主 checkout 落后 trunk | 只补缺的那一个，不整体重装、不扩测试范围 |
| **旧测试断言过时**（最常见）| "5 项失败全是旧断言把'已支付、待发货'当流程时间"；"旧结构：成员管理/普通会员混在管理页" | 结构改了，测试没跟着改 | 直接改断言到新结构，**不回退正确交互**。这不是"测试红了"。 |
| trunk 改了脚本名 / 路径 | "最新主轴把类型检查脚本改了名字"；"适配分层模块路径解析" | 仓库演进，会话记的是旧命令 | 用包自己的脚本，别扩范围 |
| "扩大到全部 X 测试" | 改 3 个文件 → 跑 95 个 console 测试 → 撞上无关的历史失败 | `related-tests` 对共享文件扇出太宽 | 只跑改动直接相关的，不跑全量 |
| 浏览器三尺寸视觉核对 | "启动隔离预览做 1600×1024 和手机端核对" | 会话自己给"照满分图"任务加的 QA | **跳过。** 测试过了直接开 PR（第 4 条）|
| 本地重 build CI 已做的 | 本地 `npm run build:console`，CI 早已 build+package | 会话不信任流水线 | 会话到"合并+CI 绿"为止，不本地 build |
| 部署引擎拒绝 | "生产指针尚未接入 / productionEnabled:false" | 发布引擎那套没接 console/auth-web | **别管引擎。** 部署 = rsync（第 2 条）|
| worktree 被外部清掉 | "任务专属 worktree 在测试通过后被外部清理" | 别的进程 / 清理动了 `/private/tmp` 或 `.codex/worktrees` | 重建同路径继续；别在 `/private/tmp` 放要紧的东西 |
| 上批"完成"其实没完 | "第一批完成"→其实只本地 commit 未推送 | 会话之间凭报告叠加 | 开工前核对上批**实际**到哪级；以 Ethan 的话为准（第 3 条）|

**判断口径**：真代码 bug 约占 30%（stale 期望 + 路径 + 版本号），70% 是上面这些工具链摩擦 + AI 过度小心。撞到这一栏里的东西，一句话带过，继续，不写长篇"失败分析"。
