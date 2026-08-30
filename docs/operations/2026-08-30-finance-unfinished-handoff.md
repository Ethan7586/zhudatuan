# 财务系统未完成工作与续办交接报告

> 交接时间：2026-08-30（Asia/Shanghai）
> 状态：本地 MVP 验收通过；display-only 演示部署未完成；生产发布基线未成立。

## 1. 结论先行

- 财务专项当前为 **90/100 本地验收**，不是生产上线评分。
- 账务正确性、对账修复、四眼复核、权限证明、试算平衡、可配置税率／字段定义及 Console 主要交互已经完成并通过专项测试。
- 所有成果仍位于未提交的混合工作树；当前 HEAD 为 `01f1ed49dd5df67d28956a116de066f5fa1d5668`，交接时 `git status --porcelain` 共 365 项，包含其他任务变更。
- **不得从当前 dirty 工作树制作真实生产 Release，也不得整批提交、回退、stash 或覆盖非财务修改。**
- display-only 财务演示制品已准备，但生产 ECS 部署在 systemd unit 校验阶段停止；最后权威回报为正式 unit、`finance-preview-current` 与 4313 均不存在，Caddy 未切换。随后只在本地生成了加固 unit，尚未交付 ECS。
- 未提交、未推送、未执行生产数据库 Migration；真实 Finance API、Jobs、真实登录/RLS 与 Provider 环境均未上线。

## 2. 唯一工程与执行边界

- 唯一日常工作目录：`/Users/Ethan/Desktop/Projects/zhudatuan/main`
- `archives/` 只在 Owner 明确要求时定向只读；禁止写入旧 Smart Wing。
- 禁止触碰 `/Users/Ethan/Desktop/Projects/suanchouweiwo`、部署配置、DNS、Cloudflare、支付 Provider 实际配置及其他项目。
- 财务任务范围：finance／invoice 后端、财务 Operation／合同、财务 Migration、Console 财务页面、财务权限／审计、Payment `occurredAt` 已批准最小证据交界及相关测试。
- 共享订单／支付／商品／供应商／分销合同若超出已批准交界，必须先暂停并向 Command Center 申请。
- 当前生产 ECS/Caddy 唯一执行 Owner 是“部署”任务；财务任务继续保持远端零写入。

协调任务：

- Command Center：`01a0446a-9769-7981-b044-45fb63c5b54d`
- 部署任务：`01a042bb-0d0f-7000-a89a-751c8b00cfe4`
- 本财务任务：`01a03e55-25a4-7911-a826-0d06768f86bd`

## 3. 已完成能力

### 3.1 账务与对账

- 混合 Tender／Allocation 与部分退款按外部渠道份额记账和对账，避免把整笔 payment 与单一渠道比较产生伪差异。
- 双向对账同时发现“外部有／内部无”及“内部有／外部无”；手续费、调整、多对一等能力明确支持或明确拒绝。
- Statement 改为 Scope／账簿／科目／币种维度的安全整数试算平衡与余额，不再使用 Scope 总借贷冒充 closing balance。
- posted journal 不直接更新或删除；更正、取消和冲销使用不可变关联 journal。
- 对账差异支持 read → preview → submit → 四眼 decide → execute/reverse → authoritative reread → receipt/effect 审计链。
- 结算、打款 uncertain/recovery、期间关闭、迟到事件、发票红冲、子账总账核对均有真数据库行为测试。

### 3.2 权限、安全与审计

- action-bound proof 已贯穿 Identity 发放、SDK header、CORS、OperationController 与 AccessPipeline。
- critical write 校验 Scope、Level 3 Step-up、ExpectedVersion、itemVersion、幂等键、request/source hash、RLS 与审计回执。
- reconciliation repair 五张表 default-deny；业务只通过受控 `SECURITY DEFINER` 函数访问，并有显式 REVOKE／EXECUTE 收敛。
- 提案人与复核人必须不同；旧客户端或合同不匹配时 fail-closed。
- Payment 仅持久化并使用已验签 provider `occurredAt`／effect 证据，不改变支付状态机、Provider 配置或公共 payload，无历史回填。

### 3.3 税率与可配置字段

- 税务规则支持国家／地区、税种、商品税务分类、HS Code、安全整数 `ratePpm`、含税方式、舍入、优先级、有效期和来源。
- active interval overlap 在数据库锁内拒绝；配置使用 revision、草稿、提交、四眼批准／拒绝和受控停用。
- 字段定义支持 12 个适用模块和 14 种数据类型，单选／多选约束在服务端及数据库共同校验。
- Console 支持新增、编辑、停用、提交、批准、拒绝；production 使用 typed authoritative API，本地 preview 修改只在当前 session 存活。

### 3.4 Console

- 已有支付对账、退款对账、结算单、账本分录、对账规则、审计记录六页签。
- URL 保存 tab、筛选、分页、抽屉选择及规则编辑状态；支持刷新及前进／后退恢复。
- 支持 cursor 分页、50 条边界、搜索／筛选、loading/error/empty、差异抽屉、键盘／焦点和 Axe。
- 未授权或未完成的高风险动作真实 disabled；不使用说明文字伪装关闭。
- production 不读取 Fixture，浏览器不重算账务金额、全量计数或预计结果。

## 4. Migration 顺序

必须保持以下 forward-only 顺序，不改写历史 Migration：

1. `20260828091000_finance_reconciliation_integrity.sql`
2. `20260828092000_finance_security_boundaries.sql`
3. `20260828093000_finance_accounting_integrity.sql`
4. `20260828094000_finance_invoice_issue_integrity.sql`
5. `20260828095000_payment_provider_time_evidence.sql`
6. `20260828100000_finance_reconciliation_repair_workflow.sql`
7. `20260830100000_finance_configurable_policy_workflow.sql`

本地数据库合同 inventory 为 179 个 Migration（historical 94、repair 85）。不得让 MigrationRunner 顺带执行未经批准的非财务 Migration。

## 5. 已完成测试证据

| 验证 | 结果 |
| --- | --- |
| Commerce finance／共享安全 unit | 15 files、57 tests passed |
| Commerce 真数据库行为 integration | 7 files、56 tests passed |
| Config policy unit／replay | 12/12；4/4 passed |
| Console finance unit | 7 files、42 tests passed |
| Contract／SDK | 4 files、16 tests；6 files、15 tests passed |
| Finance Browser E2E | 6/6 passed，包含 Axe／WCAG |
| TypeScript | commerce、console、SDK、contractgen、browser 全部通过 |
| Contract generation | `generate` 与 `check` 通过 |
| Database contract／inventory | 179 个 Migration PGlite fresh replay 与 inventory 通过 |
| 真 PostgreSQL | PostgreSQL 17 隔离环境 179 个 Migration 全量 replay 通过 |
| Quality gates | 定向 ESLint、Prettier、Console production build、`git diff --check` 通过 |

这些是本地专项证据，不可替代生产数据库、真实身份 Browser E2E 或线上回执。

## 6. 本地评分

| 维度 | 得分 | 结论 |
| --- | ---: | --- |
| 业务覆盖 | 22/25 | 主闭环与税务／字段治理成立；跨商品／订单税额快照未接入 |
| 账务与数据正确性 | 23/25 | Tender、双向对账、试算平衡、冲正及真 DB 证据成立 |
| 对账／结算／异常闭环 | 18/20 | 修复、四眼、回执及 uncertain/recovery 已验证 |
| 权限／安全／审计 | 14/15 | proof、Step-up、ExpectedVersion、RLS、幂等与审计闭合 |
| VI／UI／UE | 13/15 | 六页签、规则编辑、URL 恢复、可访问性及 fail-closed 成立 |
| **合计** | **90/100** | **仅本地 MVP 验收，不等同生产发布** |

## 7. display-only 演示部署停点

### 7.1 本地不可变制品

- Artifact：`/Users/Ethan/Desktop/Projects/zhudatuan/main/.finance-deploy.VJ330I`
- Release ID：`finance-preview-20260830T011043Z-2ac8e932a21c`
- apps/runtime checksum manifest：`2ac8e932a21c0f92a7ddbe376c37e3e9aa1e1c6689a7f0f2c5e6a622d5c28666`
- source-files manifest：`971ec871440f2a38883911103aab5845c581de92bb539b2503c1ff73a479a0c0`（414 files）
- `release.json`：`35399a0bd7ca2a55efcb526316cd351b180729aa9e67e839327f1bea20d8a7dd`
- Bundled runtime：`84f171227e1f733b2a987c7d7bc654f7f06c5cbf858088b088d3f6fde60c8fdb`
- 冻结 Caddy candidate：`.finance-deploy.VJ330I/evidence/Caddyfile.candidate`
- Caddy candidate SHA：`08844b78904774dd8705e4386f77f302f90ca0bc2dfdbcd0e26fdd263a934410`
- 候选所基于的当时线上 Caddy SHA：`09db2f75acaa3dd7f8d3a826f6f1188baa66cda75061b35a2e2d5b738c00c5d1`
- 新 hardened unit：`.finance-deploy.VJ330I/evidence/zhudatuan-finance-preview.hardened.service`
- Hardened unit：730 bytes、31 LF lines、SHA `ea2ebaaddc7b62d3b18054a3cdc8a1f5e62af8230815f7a42dd2d1666bff4f39`

旧 Caddy 候选 `681c75…` 与 `75291a…` 已撤销，禁止使用。唯一 Caddy 候选是 `08844…`。

### 7.2 路由边界

- GET／OPTIONS 精确 8 路：
  - `/api/v1/identity/session`
  - `/api/v1/members/me`
  - `/api/v1/finance/overview`
  - `/api/v1/finance/reconciliations`
  - `/api/v1/finance/entries`
  - `/api/v1/finance/settlements`
  - `/api/v1/finance/policies`
  - `/api/v1/finance/audits`
- 仅 6 条已批准 finance endpoint 的非 GET／OPTIONS 返回 405。
- 未知 finance/API/health 路径继续返回 404。
- 静态资源为 70 个 `/assets/...` 与 10 个 `/brand/...` 逐文件白名单；禁止恢复 wildcard。
- 既有 Labs `design-references`／`demo` 及其他 Host 不得改变。

### 7.3 失败根因与修复证据

- 原 unit 的正确逐字节 SHA 是 `a32855d75bd6ca7c351a64899d708216561b55b6ca59f67cd4308b5cb589d33a`。
- C-install 脚本曾误写为 `3a2855d75bd6…`，前四位转置会稳定触发 `unit_hash_mismatch`。
- 原 unit 只有 `NoNewPrivileges`／`PrivateTmp`，且未指定用户，systemd 默认以 root 运行，因此已被本地 hardened unit 取代。
- Hardened unit 使用 `DynamicUser=yes`、空 capability sets、`ProtectSystem=strict`、`ProtectHome`、`PrivateDevices`、kernel/control-group 保护及地址族限制；没有 `MemoryDenyWriteExecute`，以免破坏 Node/V8 JIT。
- Runtime 明确绑定 `127.0.0.1:4313`，无外部 listen、secret、持久写目录或生产数据库访问。

### 7.4 当前远端事实边界

- 财务任务最后收到的权威回报：重试在正式 unit install/start 前失败；`finance-preview-current`、正式 unit、4313 均不存在；Caddy 未触及，线上 Labs 保持原基线。
- 财务任务没有在 hardened unit 生成后访问 ECS，故不得把上述事实冒充为当前独立复核。
- Hardened unit 尚未获得 Command Center 最终部署放行，也尚未在目标 systemd 版本执行远端 verify。
- 在任何新批次开始前，部署 Owner 必须重新只读确认远端实际状态和 Caddy baseline SHA。

### 7.5 下一次部署的强制门槛

仅部署任务可执行：

1. 确认远端 Caddy SHA 仍与候选 baseline 完全一致；漂移即停止并重建候选，禁止直接套用。
2. 对 hardened unit 执行目标机 `systemd-analyze verify`。
3. 使用 `namei -l` 等只读方式确认 DynamicUser 可 traverse/read `/srv/zhudatuan-display/finance-preview-current`、不可变 release 及 `runtime/FinancePreviewServer.mjs`；目录通常至少需可遍历，runtime 文件需可读。
4. 服务先只在 `127.0.0.1:4313` 启动并做 localhost smoke；失败必须清理 unit/link/listener，不进入 Caddy。
5. 完整 Caddy candidate 必须在目标 Caddy 版本通过 `adapt --validate` 与 `validate`，然后才可原子 install/reload。
6. 公网验收：财务页面 200；8 路 GET 正常；已批准写请求 405；未知 API 404；root、Console、Accounts、Labs references 与既有站点回归通过。
7. 保存 backup、安装前后 SHA、unit/link/listener 状态及完整回滚证据；任何门槛失败立即恢复。

演示成功后的入口预计为：

`https://labs.zhudatuan.com/scopes/platform/platform%3Apreview/finance?tab=rules&ruleKind=fields`

必须明确标注 `LOCAL-PREVIEW`：字段／税率编辑仅在当前浏览器 session 内演示，刷新不落库；这不是生产 Finance API。

## 8. 仍未完成的生产工作

### P0：发布与运行时

1. 当前 generated contract checksum `5a809a93…` 与数据库最新 contract head `9accf457…` 不一致；真实 `ApiMain` 会触发 `RUNTIME_COMPATIBILITY_FAILED`。
2. 当前工作树混有 365 项跨任务修改，`releaseEligible=false`，不满足 clean checkout 发布合同。
3. `TARGET_SCHEMA_HEAD` 仍停在旧值，不能证明 7 个财务 Migration 的生产兼容状态。
4. 现有 MigrationRunner 会夹带未授权的非财务 20260829 Migration；不得直接运行。
5. 正式运行合同缺少 Jobs 闭环、真实登录/RLS、生产 Secret/KMS、Provider sandbox 和生产回滚快照证据。
6. 尚未执行生产数据 Migration、真实身份 Browser E2E、线上审计回执或生产数据核对。

### P1：业务边界

1. 商品／订单成交时的司法辖区判定、税额计算和不可变税率快照尚未接入；这是跨商品／订单合同，需新授权。
2. 自定义字段目前只有定义／元数据治理，尚无任意业务记录的通用值存储、索引、校验和报表语义。
3. 高风险“导出对账单”和“发起对账”缺少独立受控 Operation／完整回执，必须继续 disabled。
4. 真正生产写动作启用前仍需从 clean release 重新验证 Preview → Step-up → proof → ExpectedVersion → idempotency → Execute → reread → receipt 全链路。

## 9. 新 session 建议执行顺序

1. 进入 `/Users/Ethan/Desktop/Projects/zhudatuan/main`，读取本报告、`AGENTS.md` 和 `docs/operations/2026-08-28-finance-upgrade-log.md`。
2. 只读执行 `git rev-parse HEAD` 与 `git status --short`；确认并保留所有非财务变更，不清理、不回退、不 stash。
3. 核对 `.finance-deploy.VJ330I` 中 manifest、冻结 Caddy candidate 和 hardened unit 的 SHA；任何不一致立即停止。
4. 读取 Command Center 与部署任务最新状态；不得仅凭本报告假设远端仍处于旧状态。
5. 若 Owner／Command Center 仅批准 display-only 部署，严格交由部署任务按第 7.5 节执行，财务任务只做本地证据与最终只读验收。
6. 若目标是正式 Finance 上线，先建立明确批准的 clean finance-only release，解决 checksum/schema head/Migration 夹带/Jobs/Auth/RLS/Secret/回滚证据；不得用 display-only 制品替代。
7. 达到新阶段验收点后，更新本报告或新建后续报告，并同步 Ethan 与 Command Center。

## 10. 禁止事项

- 不得提交、推送或部署，除非 Ethan 对该动作再次明确授权。
- 不得从当前 mixed dirty tree 直接构建真实生产 API 或运行生产 Migration。
- 不得改写 generated SDK、使用浏览器 direct fetch/BFF、把 Fixture 当生产事实，或在浏览器计算账务真相。
- 不得覆盖、回退或重写商品、订单、登录、部署、fufu、卡券、供应商、分销及其他任务变更。
- 不得使用已撤销 Caddy 候选，不得恢复 `/assets/*`、`/brand/*` 或未知 finance API wildcard。
- 不得让 Node preview 以 root 或公网地址运行；不得向 unit 注入密码、Token、连接串或写目录。

## 11. 发布基线声明

- **本地验收基线：成立，90/100。**
- **display-only 部署：未完成。**
- **生产发布基线：未成立。**
- **可供部署读取的已确认生产基线：无。**

新 session 不得把“代码完成”“本地 90 分”“制品已生成”中的任何一项表述为“财务系统已经生产上线”。

## 12. 可复制给新 session 的启动提示

```text
继续 /Users/Ethan/Desktop/Projects/zhudatuan/main 的财务系统任务。先读取 AGENTS.md、docs/operations/2026-08-30-finance-unfinished-handoff.md 和 docs/operations/2026-08-28-finance-upgrade-log.md；只读核对 HEAD、git status、冻结 artifact/Caddy/unit SHA 及 Command Center／部署任务最新状态。保留全部非财务未提交修改，不清理、不回退、不 stash。当前本地验收为 90/100，但 display-only 部署未完成、生产发布基线未成立。未经 Ethan 新授权，不提交、不推送、不执行生产 Migration、不部署、不访问 ECS；生产 ECS/Caddy 只能由部署任务执行。先报告当前真实停点，再按交接报告的未完成 P0 顺序继续。
```
