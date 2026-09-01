# 卡券目标操作追踪矩阵

> 本矩阵是批次 0 的实施清单。机器事实仍只有 `packages/contract/definitions/operations.yml`；本文用于审计设计意图、规范化操作、MVP 来源、生成产物和验证方式，不提供别名或运行时映射。

## 1. 冻结规则

- 目标操作共 74 项：`partner` 7 项、`approval` 10 项、`voucher` 57 项。
- 全部目标操作在批次 0 标记为 `availability=frozen`。Contract、OpenAPI 和 SDK 会生成；服务端生成注册能够识别但不开放路由，数据库能力发布也不包含未实现操作。
- 批次 1 及后续实现某项操作后，只把该项切换为 `runtime`，不得修改其 ID、方法、路径、owner 或 SDK 模块。
- 全部目标操作使用 `schema=structural`；批次 0 冻结结构契约边界，具体领域 DTO 在对应业务批次通过同一 Schema 生成机制收紧，不建立第二套 DTO。
- 策略列顺序固定为：`idempotent · idempotency · expectedVersion · execution`。
- 生成列中的 `partner.ts`、`approval.ts`、`voucher.ts` 均指 `packages/sdk/src/operations/` 下的生成文件；服务端归属由 owner 生成。
- 验证 `C/G/S` 分别表示 Contract 目标测试、ContractGenerator 生成检查、SDK 目标测试。

权限与能力决定：

- Partner、Voucher、Reporting 和 Verification 操作全部复用既有权限，不创建近义代码。
- 既有审批决定权限都绑定售后或福利金等具体上下文，无法表达独立 Approval 上下文而不造成反向耦合。因此只新增 `approval.read`、`approval.template.manage`、`approval.task.decide` 三项；分别覆盖查询、模板变更和任务决定，不在操作、前端或服务端重复定义。
- 已删除只复制操作 ID、owner、permission 和 audience 的 `capabilities.yml`。操作能力、权限绑定与数据库发布行统一从 `operations.yml` 生成；frozen 操作不发布能力，切为 runtime 后由同一生成链发布。

## 2. 需求证据

| 需求 | 工作簿证据 | 本批映射范围 |
| --- | --- | --- |
| `MVP03` | `MVP上线功能清单` 第 3 行包含平台卡号库 | Credential Pool、Credential 及其生成、导入、导出和作业查询 |
| `MVP09` | 第 9 行集团卡券中心：客户、产品、备券、卡券、审批、操作、查询、消费明细 | 集团范围内的全部目标卡券操作 |
| `MVP18` | 第 18 行商城卡券中心，内容与第 9 行一致但受商城 Scope 限制 | 商城范围内的全部目标卡券操作 |

`MVP11/MVP20` 的卡券消费统计继续由现有 `reporting.voucherconsumption.read` 承担，不重复映射到运营查询操作。

## 3. 目标矩阵

### 3.1 Partner Customer（7）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 新增客户及联系人 | `partner.customers.create` | `POST /api/v1/partners/customers` | `partner.manage` | `false · required · none · sync` | `MVP09,MVP18` | `partner.ts · partner` | `C/G/S` |
| 更新客户及联系人 | `partner.customers.update` | `PATCH /api/v1/partners/customers/{customerid}` | `partner.manage` | `false · required · required · sync` | `MVP09,MVP18` | `partner.ts · partner` | `C/G/S` |
| 启用客户 | `partner.customers.enable` | `POST /api/v1/partners/customers/{customerid}/enable` | `partner.manage` | `false · required · required · sync` | `MVP09,MVP18` | `partner.ts · partner` | `C/G/S` |
| 停用客户 | `partner.customers.disable` | `POST /api/v1/partners/customers/{customerid}/disable` | `partner.manage` | `false · required · required · sync` | `MVP09,MVP18` | `partner.ts · partner` | `C/G/S` |
| 客户详情 | `partner.customers.get` | `GET /api/v1/partners/customers/{customerid}` | `partner.read` | `true · none · none · sync` | `MVP09,MVP18` | `partner.ts · partner` | `C/G/S` |
| 客户列表 | `partner.customers.list` | `GET /api/v1/partners/customers` | `partner.read` | `true · none · none · sync` | `MVP09,MVP18` | `partner.ts · partner` | `C/G/S` |
| 客户轻量选项 | `partner.customeroptions.list` | `GET /api/v1/partners/customer-options` | `partner.read` | `true · none · none · sync` | `MVP09,MVP18` | `partner.ts · partner` | `C/G/S` |

### 3.2 Voucher Product（7）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 创建产品及首版本 | `voucher.products.create` | `POST /api/v1/vouchers/products` | `voucher.program.manage` | `false · required · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 创建产品新版本 | `voucher.products.revise` | `POST /api/v1/vouchers/products/{productid}/versions` | `voucher.program.manage` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 启用产品 | `voucher.products.enable` | `POST /api/v1/vouchers/products/{productid}/enable` | `voucher.program.manage` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 停用产品 | `voucher.products.disable` | `POST /api/v1/vouchers/products/{productid}/disable` | `voucher.program.manage` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 产品详情 | `voucher.products.get` | `GET /api/v1/vouchers/products/{productid}` | `voucher.program.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 产品列表 | `voucher.products.list` | `GET /api/v1/vouchers/products` | `voucher.program.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 当前产品选项 | `voucher.productoptions.list` | `GET /api/v1/vouchers/product-options` | `voucher.program.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |

### 3.3 Credential Pool 与 Credential（10）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 建立凭证池 | `voucher.credentialpools.create` | `POST /api/v1/vouchers/credential-pools` | `voucher.cardlibrary.manage` | `false · required · none · sync` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 批量生成卡号券密 | `voucher.credentials.generate` | `POST /api/v1/vouchers/credential-pools/{poolid}/generate` | `voucher.cardlibrary.manage` | `false · required · required · async` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 导入实体卡号 | `voucher.credentials.import` | `POST /api/v1/vouchers/credential-pools/{poolid}/imports` | `voucher.cardlibrary.manage` | `false · required · required · async` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 关闭凭证池 | `voucher.credentialpools.close` | `POST /api/v1/vouchers/credential-pools/{poolid}/close` | `voucher.cardlibrary.manage` | `false · required · required · sync` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 凭证池详情 | `voucher.credentialpools.get` | `GET /api/v1/vouchers/credential-pools/{poolid}` | `voucher.cardlibrary.read` | `true · none · none · sync` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 凭证池列表 | `voucher.credentialpools.list` | `GET /api/v1/vouchers/credential-pools` | `voucher.cardlibrary.read` | `true · none · none · sync` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 凭证列表 | `voucher.credentials.list` | `GET /api/v1/vouchers/credentials` | `voucher.cardlibrary.read` | `true · none · none · sync` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 凭证详情 | `voucher.credentials.get` | `GET /api/v1/vouchers/credentials/{credentialid}` | `voucher.cardlibrary.read` | `true · none · none · sync` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 导出凭证资源 | `voucher.credentialexports.create` | `POST /api/v1/vouchers/credential-exports` | `reporting.export.manage` | `false · required · none · async` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 作业进度 | `voucher.jobs.get` | `GET /api/v1/vouchers/jobs/{jobid}` | `voucher.batch.read` | `true · none · none · sync` | `MVP03,MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |

### 3.4 Stock Request（7）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 新建备券草稿 | `voucher.stockrequests.create` | `POST /api/v1/vouchers/stock-requests` | `voucher.reserve.request` | `false · required · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 编辑备券草稿 | `voucher.stockrequests.update` | `PATCH /api/v1/vouchers/stock-requests/{requestid}` | `voucher.reserve.request` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 提交备券审批 | `voucher.stockrequests.submit` | `POST /api/v1/vouchers/stock-requests/{requestid}/submit` | `voucher.reserve.request` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 取消备券申请 | `voucher.stockrequests.cancel` | `POST /api/v1/vouchers/stock-requests/{requestid}/cancel` | `voucher.reserve.request` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 备券详情 | `voucher.stockrequests.get` | `GET /api/v1/vouchers/stock-requests/{requestid}` | `voucher.reserve.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 备券列表 | `voucher.stockrequests.list` | `GET /api/v1/vouchers/stock-requests` | `voucher.reserve.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 可用备券选项 | `voucher.stockrequestoptions.list` | `GET /api/v1/vouchers/stock-request-options` | `voucher.reserve.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |

### 3.5 Approval（10）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 创建审批模板 | `approval.templates.create` | `POST /api/v1/approvals/templates` | `approval.template.manage` | `false · required · none · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |
| 修订审批模板 | `approval.templates.revise` | `POST /api/v1/approvals/templates/{templateid}/versions` | `approval.template.manage` | `false · required · required · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |
| 启用审批模板 | `approval.templates.enable` | `POST /api/v1/approvals/templates/{templateid}/enable` | `approval.template.manage` | `false · required · required · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |
| 停用审批模板 | `approval.templates.disable` | `POST /api/v1/approvals/templates/{templateid}/disable` | `approval.template.manage` | `false · required · required · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |
| 审批模板详情 | `approval.templates.get` | `GET /api/v1/approvals/templates/{templateid}` | `approval.read` | `true · none · none · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |
| 审批模板列表 | `approval.templates.list` | `GET /api/v1/approvals/templates` | `approval.read` | `true · none · none · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |
| 我的审批任务 | `approval.tasks.list` | `GET /api/v1/approvals/tasks` | `approval.read` | `true · none · none · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |
| 同意审批任务 | `approval.tasks.approve` | `POST /api/v1/approvals/tasks/{taskid}/approve` | `approval.task.decide` | `false · required · required · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |
| 驳回审批任务 | `approval.tasks.reject` | `POST /api/v1/approvals/tasks/{taskid}/reject` | `approval.task.decide` | `false · required · required · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |
| 审批实例详情 | `approval.instances.get` | `GET /api/v1/approvals/instances/{instanceid}` | `approval.read` | `true · none · none · sync` | `MVP09,MVP18` | `approval.ts · approval` | `C/G/S` |

### 3.6 Issue Order 与 Issue Batch（9）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 创建发行订单 | `voucher.issueorders.create` | `POST /api/v1/vouchers/issue-orders` | `voucher.issue` | `false · required · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 编辑发行订单 | `voucher.issueorders.update` | `PATCH /api/v1/vouchers/issue-orders/{orderid}` | `voucher.issue` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 提交发行订单 | `voucher.issueorders.submit` | `POST /api/v1/vouchers/issue-orders/{orderid}/submit` | `voucher.issue` | `false · required · required · async` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 取消发行订单 | `voucher.issueorders.cancel` | `POST /api/v1/vouchers/issue-orders/{orderid}/cancel` | `voucher.issue` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 发行订单详情 | `voucher.issueorders.get` | `GET /api/v1/vouchers/issue-orders/{orderid}` | `voucher.batch.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 发行订单列表 | `voucher.issueorders.list` | `GET /api/v1/vouchers/issue-orders` | `voucher.batch.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 重试发行批次 | `voucher.issuebatches.retry` | `POST /api/v1/vouchers/issue-batches/{batchid}/retry` | `voucher.issue` | `false · required · required · async` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 发行批次详情 | `voucher.issuebatches.get` | `GET /api/v1/vouchers/issue-batches/{batchid}` | `voucher.batch.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 导出发行订单 | `voucher.issueorderexports.create` | `POST /api/v1/vouchers/issue-order-exports` | `reporting.export.manage` | `false · required · none · async` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |

### 3.7 Action Batch（5）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 创建批量状态操作 | `voucher.actionbatches.create` | `POST /api/v1/vouchers/action-batches` | `voucher.status.manage` | `false · required · none · async` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 批量操作详情 | `voucher.actionbatches.get` | `GET /api/v1/vouchers/action-batches/{actionbatchid}` | `voucher.history.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 批量操作列表 | `voucher.actionbatches.list` | `GET /api/v1/vouchers/action-batches` | `voucher.history.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 重试批量操作 | `voucher.actionbatches.retry` | `POST /api/v1/vouchers/action-batches/{actionbatchid}/retry` | `voucher.status.manage` | `false · required · required · async` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 导出批量操作 | `voucher.actionexports.create` | `POST /api/v1/vouchers/action-exports` | `reporting.export.manage` | `false · required · none · async` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |

### 3.8 Voucher 激活、绑定与详情（7）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 仅券密激活 | `voucher.activations.secret` | `POST /api/v1/vouchers/activation/secret` | — | `false · required · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 券号加券密激活 | `voucher.activations.numbersecret` | `POST /api/v1/vouchers/activation/number-secret` | — | `false · required · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 绑定最终用户 | `voucher.vouchers.bind` | `POST /api/v1/vouchers/{voucherid}/bind` | `voucher.binding.manage` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 解绑最终用户 | `voucher.vouchers.unbind` | `POST /api/v1/vouchers/{voucherid}/unbind` | `voucher.binding.manage` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 单卡详情 | `voucher.vouchers.get` | `GET /api/v1/vouchers/{voucherid}` | `voucher.history.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 按券号查询 | `voucher.vouchers.getbynumber` | `GET /api/v1/vouchers/by-number/{number}` | `voucher.history.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 生命周期时间线 | `voucher.vouchers.timeline` | `GET /api/v1/vouchers/{voucherid}/timeline` | `voucher.history.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |

### 3.9 Redemption、Tender Hold 与 Refund（7）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 核销报价校验 | `voucher.redemptions.quote` | `POST /api/v1/vouchers/redemptions/quote` | `verification.verify` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 创建金额预占 | `voucher.tenderholds.create` | `POST /api/v1/vouchers/tender-holds` | `verification.verify` | `false · required · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 预占转消费 | `voucher.tenderholds.consume` | `POST /api/v1/vouchers/tender-holds/{holdid}/consume` | `verification.verify` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 释放金额预占 | `voucher.tenderholds.release` | `POST /api/v1/vouchers/tender-holds/{holdid}/release` | `verification.verify` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 直接核销 | `voucher.redemptions.create` | `POST /api/v1/vouchers/redemptions` | `verification.verify` | `false · required · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 部分或全额退款 | `voucher.refunds.create` | `POST /api/v1/vouchers/redemptions/{redemptionid}/refunds` | `voucher.redemption.reverse` | `false · required · required · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 核销详情 | `voucher.redemptions.get` | `GET /api/v1/vouchers/redemptions/{redemptionid}` | `voucher.redemption.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |

### 3.10 Search Document 与 Export Job（5）

| 设计操作 | 规范化操作 | HTTP | 权限 | 策略 | 需求 | 生成 | 验证 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 统一卡券搜索 | `voucher.search.read` | `GET /api/v1/vouchers/search` | `voucher.history.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 搜索筛选计数 | `voucher.searchfacets.read` | `GET /api/v1/vouchers/search/facets` | `voucher.history.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 冻结搜索目标集 | `voucher.searchsnapshots.create` | `POST /api/v1/vouchers/search-snapshots` | `voucher.history.read` | `false · required · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 创建搜索导出 | `voucher.searchexports.create` | `POST /api/v1/vouchers/search-exports` | `reporting.export.manage` | `false · required · none · async` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |
| 导出作业详情 | `voucher.exports.get` | `GET /api/v1/vouchers/exports/{exportid}` | `reporting.export.read` | `true · none · none · sync` | `MVP09,MVP18` | `voucher.ts · voucher` | `C/G/S` |

## 4. 既有操作处置

以下 19 项是当前生产代码、旧 Console 或既有旅程仍引用的运行态操作。批次 0 不删除、不改路由、不转发到目标操作；它们唯一的删除批次是批次 6 一次性切换。新页面和批次 1 以后新增代码不得引用这些操作。

| 资源 | 既有运行态操作 | 当前调用证据 |
| --- | --- | --- |
| 卡号库 | `voucher.cardlibraries.read/create/allocate`、`voucher.imports.read` | Voucher Console、导入流程、MVP03 |
| 产品 | `voucher.programs.read/manage` | Voucher Console、VoucherOperations、MVP09 |
| 备券 | `voucher.reserves.read/request/decide` | Voucher Console、VoucherOperations、MVP09 |
| 发行 | `voucher.batches.read/issue/retry` | Voucher Console、VoucherOperations、MVP09/MVP18 |
| 状态 | `voucher.status.batch`、`voucher.statusbatches.read` | VoucherOperations、VoucherJobs、MVP09/MVP18 |
| 绑定 | `voucher.bindings.read/manage` | Storefront/Console、VoucherQueries、MVP18 |
| 核销 | `voucher.redemptions.read/reverse` | Storefront、VoucherOperations、MVP18 |
| 历史 | `voucher.history.read` | Voucher Console、VoucherQueries |

目标退款操作规范化为 `voucher.refunds.create`，不会把既有 `voucher.redemptions.reverse` 当作别名继续使用。

## 5. 生成与验证闭环

每个矩阵项都必须从唯一 YAML 定义生成：

1. `packages/contract/openapi.json`
2. `packages/contract/src/operations/CommerceOperations.ts`
3. `packages/contract/src/operations/CommerceSchemas.ts`
4. 对应 `packages/sdk/src/operations/{owner}.ts`
5. `packages/sdk/src/operations/CommerceClient.generated.ts`
6. 服务端生成注册中的 frozen/runtime 分类
7. Contract checksum

目标测试必须断言总数、owner 数量、完整路由、策略、需求标签、SDK 分组、frozen 不可路由以及既有 19 项仍为 runtime。生成检查再证明 OpenAPI、Contract、SDK、服务端注册和数据库契约没有漂移。
