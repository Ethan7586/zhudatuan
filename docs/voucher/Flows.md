# 卡券调用与数据流

## 1. 通用请求流水线

所有 HTTP 命令和查询沿用同一入口，不允许业务页面绕过：

```mermaid
sequenceDiagram
    autonumber
    actor User as 操作人
    participant UI as Console
    participant HTTP as HttpApp
    participant Access as AccessPipeline
    participant Route as Route
    participant Bus as CommandBus/QueryBus
    participant Handler as Handler
    participant Uow as UnitOfWork
    participant Repo as Repository
    participant DB as PostgreSQL

    User->>UI: 提交操作
    UI->>HTTP: 请求 + contract version + idempotency + expected version
    HTTP->>Access: 解析会话与 Scope
    Access-->>HTTP: AccessContext
    HTTP->>Route: 已解析 OperationRequest
    Route->>Bus: Command 或 Query DTO
    Bus->>Handler: 分发唯一处理器
    alt 写命令
        Handler->>Uow: begin
        Uow->>Repo: load/save
        Repo->>DB: 参数化 SQL
        Handler->>Uow: 保存事件
        Uow->>DB: commit
    else 查询
        Handler->>Repo: keyset query
        Repo->>DB: 只读查询
    end
    Handler-->>Bus: 业务回执
    Bus-->>Route: Result
    Route-->>UI: 结构化响应
```

## 2. 客户管理

### 2.1 新增客户

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI as Customer Form
    participant Route as CustomerRoutes
    participant Command as CreateCustomer
    participant Cipher as KMS Adapter
    participant Customer as Customer Aggregate
    participant Repo as CustomerRepository
    participant Outbox

    Operator->>UI: 输入客户与联系人
    UI->>Route: POST customers
    Route->>Command: CreateCustomerInput
    Command->>Cipher: 加密电话、地址、联系人手机和邮箱
    Cipher-->>Command: ciphertext + token + keyVersion
    Command->>Customer: create(code, profile, contacts)
    Customer-->>Command: CustomerCreated event
    Command->>Repo: insert partner + customer + tags + contacts
    Command->>Outbox: append customer.created
    Command-->>UI: 201 + customer receipt
```

内部数据流：

```text
Form DTO
  → CustomerType / PaymentTerm / Contact value validation
  → KMS envelopes
  → Customer aggregate
  → PartnerRepository transaction
  → Outbox event
  → Customer read model invalidation
```

### 2.2 编辑客户

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI
    participant Command as UpdateCustomer
    participant Repo as CustomerRepository
    participant Customer as Customer Aggregate
    participant Cipher as KMS Adapter
    participant DB

    Operator->>UI: 保存编辑
    UI->>Command: customer id + expected version + fields
    Command->>Repo: load customer for update
    Repo->>DB: select partner/customer/contacts
    Repo-->>Command: aggregate
    Command->>Cipher: 加密发生改变的敏感字段
    Command->>Customer: update profile and replace contact changes
    Customer-->>Command: CustomerUpdated event
    Command->>Repo: optimistic save
    Repo->>DB: update + contact diff + version increment
    Command-->>UI: new version
```

联系人使用 ID 差异集合：新增 insert、修改 update、移除 delete；不先全删再插，避免历史引用和无意义写放大。

## 3. 产品档案

### 3.1 创建并发布产品

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI as Product Form
    participant Command as CreateProduct
    participant Types as VoucherTypeRegistry
    participant Scope as ScopePort
    participant Approval as ApprovalPort
    participant Product as VoucherProduct
    participant Repo as ProductRepository

    Operator->>UI: 输入储值券规则
    UI->>Command: create product
    Command->>Types: require storedvalue
    Types-->>Command: StoredValueType
    Command->>Scope: validate mall
    Scope-->>Command: mall fact
    opt 指定审批模板
        Command->>Approval: get active template revision
        Approval-->>Command: template snapshot
    end
    Command->>Product: create draft and version 1
    Command->>Repo: save product and immutable version
    Command-->>UI: product receipt
```

### 3.2 修改产品

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant Command as ReviseProduct
    participant Repo as ProductRepository
    participant Product as VoucherProduct
    participant Types as VoucherTypeRegistry

    Operator->>Command: 新规则 + expected version
    Command->>Repo: load product with active version
    Command->>Types: parse new type config
    Command->>Product: revise(new rule)
    Product->>Product: append version N+1
    Product->>Product: move active pointer
    Command->>Repo: insert productversion, update pointer
    Command-->>Operator: version N+1
```

旧版本不更新，既有 StockRequest、IssueOrder 和 Voucher 继续引用旧版本。

## 4. 卡号库

### 4.1 系统生成实体凭证

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI as Library Dialog
    participant Command as GenerateCredentials
    participant Pool as CredentialPool
    participant Repo as CredentialRepository
    participant Jobs as Runtime Job
    participant Worker as CredentialJob
    participant Numbering as CredentialNumbering
    participant Cipher as CredentialCipher
    participant DB as PostgreSQL

    Operator->>UI: 数量 + 兑换方式 + 前缀
    UI->>Command: generate request
    Command->>Pool: create preparing pool
    Command->>Repo: save pool and credential job
    Command->>Jobs: enqueue credential generation
    Command-->>UI: 202 + pool/job receipt

    loop 每个可恢复 chunk
        Worker->>DB: claim job and lock pool
        Worker->>Numbering: reserve sequence range
        Numbering-->>Worker: NO/QH/QM material
        Worker->>Cipher: parallel encrypt secrets
        Cipher-->>Worker: envelopes
        Worker->>DB: bulk insert credentials and advance cursor
        Worker->>DB: update pool counters
    end
    Worker->>DB: mark job completed and pool ready
    Worker->>DB: append credentials.generated outbox
```

内部数据流：

```text
GenerationPlan
  → sequence range reservation
  → CredentialMaterial stream
  → bounded parallel KMS encryption
  → bulk INSERT
  → pool counters
  → job cursor
  → outbox
```

发生进程中断时，job cursor 与已写 credential 是恢复依据。下一次从尚未完成的 ordinal 继续，编号不回退，不重新插入成功项。

### 4.2 文件导入

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI as Import Dialog
    participant API as ImportCredentials
    participant Objects as ObjectStore
    participant Repo as CredentialRepository
    participant Worker as ImportJob
    participant Parser as Csv Parser
    participant Cipher as CredentialCipher
    participant DB

    Operator->>UI: 选择文件与兑换方式
    UI->>API: multipart upload + sha256
    API->>Objects: store immutable source
    Objects-->>API: object reference
    API->>Repo: create pool and import job
    API-->>UI: 202 job receipt
    loop 流式读取 chunk
        Worker->>Objects: read range/stream
        Worker->>Parser: parse and normalize rows
        Parser-->>Worker: valid rows + row errors
        Worker->>Cipher: encrypt valid secrets
        Worker->>DB: bulk insert valid credentials
        Worker->>DB: insert only failed row diagnostics
        Worker->>DB: advance cursor and counts
    end
    Worker->>DB: complete or fail job
```

导入验证包含：字段完整性、格式、重复 NO、重复券号、重复券密指纹、兑换方式一致。错误报告由同一 job 生成，不创建第二套导入状态。

## 5. 备券与审批

### 5.1 创建草稿并提交

```mermaid
sequenceDiagram
    autonumber
    actor Applicant as 商城管理员
    participant UI as Stock Form
    participant Command as SubmitStock
    participant Customer as CustomerPort
    participant Product as ProductRepository
    participant Pool as CredentialRepository
    participant Stock as StockRequest
    participant StockRepo as StockRepository
    participant Approval as ApprovalPort

    Applicant->>UI: 填写备券
    UI->>Command: stock fields + expected version
    Command->>Customer: require active customer
    Command->>Product: require active product version
    alt physical
        Command->>Pool: count available matching credentials
        Pool-->>Command: available count
    end
    Command->>StockRepo: load or create draft
    Command->>Stock: submit immutable revision
    Command->>StockRepo: save revision and state
    alt 有审批模板
        Command->>Approval: start subject snapshot
        Approval-->>Command: approval instance id
        Command->>Stock: mark reviewing
    else 无审批模板
        Command->>Stock: approve directly
        Command->>Pool: hold credentials if physical
    end
    Command-->>UI: stock and approval receipt
```

### 5.2 多级审批

```mermaid
sequenceDiagram
    autonumber
    actor Approver1 as 子机构管理员
    actor Approver2 as 机构管理员
    participant Inbox as Approval Inbox
    participant Command as DecideApproval
    participant Approval as ApprovalInstance
    participant Repo as ApprovalRepository
    participant Outbox
    participant Resolver as ApprovalSubscriber
    participant Stock as ResolveStock
    participant Credentials as CredentialRepository

    Approver1->>Inbox: 查看当前步骤
    Inbox->>Command: approve step 1
    Command->>Approval: decide(actor, approve)
    Approval->>Approval: complete step 1 and activate step 2
    Command->>Repo: save decision and step states

    Approver2->>Command: approve step 2
    Command->>Approval: decide(actor, approve)
    Approval->>Approval: mark instance approved
    Command->>Repo: save final decision
    Command->>Outbox: approval.instance.approved

    Outbox->>Resolver: deliver event
    Resolver->>Stock: resolve approved subject version
    alt physical
        Stock->>Credentials: lock exact available credentials
        Credentials->>Credentials: set held and stock id
    end
    Stock->>Stock: mark approved
```

如果最终凭证占用因为并发库存不足而失败，审批事实保持 approved，Stock 进入 `allocationfailed` 内部故障态并由恢复作业重试；对外不能伪装成审批拒绝。正常实现应在提交时预检、最终批准时原子占用，使该情况只可能来自外部数据故障。

### 5.3 拒绝和重提

```mermaid
sequenceDiagram
    autonumber
    actor Approver
    actor Applicant
    participant Approval
    participant Stock

    Approver->>Approval: reject with reason
    Approval-->>Stock: approval rejected event
    Stock->>Stock: reviewing to rejected
    Applicant->>Stock: revise fields
    Stock->>Stock: rejected to draft, append revision
    Applicant->>Stock: submit again
    Stock->>Approval: start new approval instance
```

旧审批实例、步骤和决定永久保留；新提交不复用旧实例。

### 5.4 审批模板维护

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant UI as Template Editor
    participant Command as ReviseTemplate
    participant Resolver as ParticipantResolver
    participant Template as ApprovalTemplate
    participant Repo as ApprovalRepository

    Admin->>UI: 配置节点和参与人规则
    UI->>Command: template revision draft
    Command->>Resolver: validate roles and scope relations
    Resolver-->>Command: normalized rules
    Command->>Template: append revision
    Command->>Template: publish revision
    Command->>Repo: insert immutable revision and move active pointer
    Command-->>UI: new active revision
```

## 6. 卡券订单与发行

### 6.1 实体券订单

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant Wizard as Order Wizard
    participant Command as SubmitOrder
    participant Customer as CustomerPort
    participant Catalog as CatalogPort
    participant StockRepo as StockRepository
    participant CredentialRepo as CredentialRepository
    participant Order as IssueOrder
    participant OrderRepo as OrderRepository
    participant Jobs as Runtime Job

    Operator->>Wizard: Step1 选择实体储值券
    Operator->>Wizard: Step2 基础、封面、价格、有效期、跳转
    Operator->>Wizard: Step3 预览自动选择的凭证
    Wizard->>Command: submit order + credential ids + expected stock version
    Command->>Customer: load active customer snapshot
    Command->>Catalog: validate jump target
    Command->>StockRepo: lock approved stock
    StockRepo-->>Command: remaining and product snapshot
    Command->>CredentialRepo: lock held credentials belonging to stock
    CredentialRepo-->>Command: exact quantity
    Command->>Order: create submitted order and computed sale total
    Command->>StockRepo: increment committed count
    Command->>CredentialRepo: held to assigned with order id
    Command->>OrderRepo: save order, batch and stable issue items
    Command->>Jobs: enqueue issue batch
    Command-->>Wizard: 202 order/batch receipt
```

如果 UI 不传凭证 ID，服务端按 sequence 自动选择。UI 传 ID 时仍要验证每张凭证属于该备券且处于 held；浏览器选择不构成可信分配事实。

### 6.2 电子券订单

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant Wizard
    participant Command as SubmitOrder
    participant StockRepo
    participant OrderRepo
    participant Jobs

    Operator->>Wizard: 选择电子储值券并填写规则
    Wizard->>Command: submit electronic order
    Command->>StockRepo: lock approved electronic stock
    Command->>Command: verify remaining and snapshots
    Command->>StockRepo: increment committed count
    Command->>OrderRepo: save order, batch, items without credentials
    Command->>Jobs: enqueue issue batch
    Command-->>Wizard: 202 receipt
```

电子券密由 IssueJob 逐项生成；订单提交阶段不生成明文密钥。

### 6.3 发行作业

```mermaid
sequenceDiagram
    autonumber
    participant Runner as JobRunner
    participant Job as IssueJob
    participant Repo as OrderRepository
    participant Cipher as CredentialCipher
    participant Voucher as Voucher Aggregate
    participant Finance as FinancePort
    participant DB as PostgreSQL
    participant Outbox

    Runner->>Job: claimed batch
    loop 每个 chunk
        Job->>Repo: claim queued issue items with skip locked
        alt electronic item
            Job->>Cipher: generate and encrypt secret
            Cipher-->>Job: electronic credential envelope
        else physical item
            Job->>Repo: load assigned credential
        end
        loop 每个 item 使用 savepoint
            Job->>Voucher: issue from product/order/credential snapshot
            Job->>DB: insert voucher and status event
            Job->>DB: mark credential issued
            Job->>DB: mark item succeeded
        end
        Job->>DB: update batch counters
    end
    Job->>Finance: post issue fact exactly once
    Finance-->>Job: finance receipt
    Job->>DB: mark batch and order completed
    Job->>DB: increment stock issued count
    Job->>Outbox: voucher.issued
```

单项失败回滚到 savepoint，只把该 Item 标记 failed，不丢弃同一 chunk 的其他成功项。基础设施级失败回滚整个 chunk，由 JobRunner 重试。

### 6.4 失败重试

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI as Batch Details
    participant Command as RetryIssue
    participant Batch as IssueBatch
    participant Jobs

    Operator->>UI: 查看失败项
    UI->>Command: retry batch
    Command->>Batch: reopen retryable failed items
    Batch->>Batch: failed items to queued, attempts increment
    Command->>Jobs: enqueue same batch id
    Command-->>UI: 202
```

成功 Item 永不重开。重试不重新扣备券、不重新分配凭证、不重复发送发行财务事实。

## 7. 激活与绑定

### 7.1 仅券密激活

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant App as Storefront
    participant Command as ActivateVoucher
    participant Cipher as CredentialCipher
    participant Repo as VoucherRepository
    participant Voucher
    participant Outbox

    Member->>App: 输入券密
    App->>Command: secret + current member
    Command->>Cipher: fingerprint normalized secret
    Command->>Repo: find issued credential by fingerprint
    Repo-->>Command: credential + voucher
    Command->>Voucher: activate and bind member
    Voucher->>Voucher: issued to bound
    Command->>Repo: save voucher + status events
    Command->>Outbox: activated and bound
    Command-->>App: voucher summary
```

### 7.2 券号加券密激活

```mermaid
sequenceDiagram
    autonumber
    actor Member
    participant Command as ActivateVoucher
    participant Cipher
    participant Repo
    participant Voucher

    Member->>Command: voucher number + secret
    Command->>Repo: find credential by normalized voucher number
    Command->>Cipher: compare secret fingerprint
    Command->>Voucher: activate and bind
    Command->>Repo: save state and events
    Command-->>Member: activation receipt
```

兑换方式由 Credential 决定。请求输入与凭证模式不一致时返回明确业务错误，不尝试第二套匹配逻辑。

### 7.3 运营人员单独绑定

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant Command as BindVoucher
    participant Member as MemberPort
    participant Repo as VoucherRepository
    participant Voucher

    Operator->>Command: voucher + member + reason
    Command->>Member: require eligible member in scope
    Command->>Repo: load voucher for update
    Command->>Voucher: bind member
    Command->>Repo: save and append event
    Command-->>Operator: bound receipt
```

## 8. 商城订单预占与核销

### 8.1 结算预占

```mermaid
sequenceDiagram
    autonumber
    participant Checkout
    participant Port as VoucherTenderPort
    participant Repo as VoucherRepository
    participant Voucher
    participant DB

    Checkout->>Port: reserve(order, member, tenders)
    Port->>Repo: lock vouchers in stable id order
    loop each voucher
        Port->>Voucher: reserve amount
        Voucher-->>Port: TenderHold
        Port->>DB: insert hold and status event
    end
    Port-->>Checkout: reserved
```

多券锁定按 Voucher ID 排序，所有调用使用同一锁顺序，避免死锁。

### 8.2 支付成功核销

```mermaid
sequenceDiagram
    autonumber
    participant Payment
    participant Port as VoucherTenderPort
    participant Repo
    participant Voucher
    participant Redemption
    participant Finance

    Payment->>Port: consume(order)
    Port->>Repo: lock open holds and vouchers
    loop each hold
        Port->>Voucher: consume held amount
        Port->>Redemption: create unique redemption
        Port->>Finance: post redeem fact
        Port->>Repo: save voucher, redemption, hold, event
    end
    Port-->>Payment: consumed
```

### 8.3 订单取消释放

```mermaid
sequenceDiagram
    autonumber
    participant Order
    participant Port as VoucherTenderPort
    participant Repo
    participant Voucher

    Order->>Port: release(order)
    Port->>Repo: lock open holds
    loop each hold
        Port->>Voucher: release reservation
        Port->>Repo: update hold and voucher state event
    end
    Port-->>Order: released
```

### 8.4 门店核销

```mermaid
sequenceDiagram
    autonumber
    actor Verifier
    participant App as Verification App
    participant Command as RedeemVoucher
    participant Verify as VerificationPort
    participant Repo
    participant Voucher
    participant Finance

    Verifier->>App: 扫码或输入券码
    App->>Verify: create verification
    Verify-->>App: verification id and scope
    App->>Command: voucher credential + verification id
    Command->>Repo: resolve and lock voucher
    Command->>Voucher: redeem remaining balance
    Command->>Repo: insert redemption and event
    Command->>Finance: post redeem fact
    Command-->>App: redemption receipt
```

## 9. 退款与冲正

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant Payment as Refund Settlement
    participant Command as ReverseRedemption
    participant Repo as VoucherRepository
    participant Redemption
    participant Voucher
    participant Finance
    participant Outbox

    Payment->>Command: redemption + amount + refund reference
    Command->>Repo: lock redemption and voucher
    Command->>Redemption: reverse partial amount
    Redemption->>Redemption: assert cumulative amount
    Command->>Voucher: restore amount and operational state
    Command->>Repo: insert reversal, update redemption and voucher, append event
    Command->>Finance: post reversal fact
    Command->>Outbox: voucher.reversed
    Command-->>Payment: reversal receipt
```

冲正后的状态：

- 会员已绑定：bound。
- 已激活但未绑定：active。
- 从未激活：issued。
- 如果冲正后仍为零余额，保持 redeemed；正常正金额冲正会离开 redeemed。

## 10. 券操作

### 10.1 创建操作批次

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI as Action Form
    participant Command as CreateAction
    participant Selector as VoucherSelector
    participant Search as VoucherSearch
    participant Batch as ActionBatch
    participant Repo as ActionRepository
    participant Jobs

    Operator->>UI: 客户 + 操作 + 单券/范围/批次
    UI->>Command: action request
    Command->>Selector: normalize selector
    Selector->>Search: resolve stable voucher ids
    Search-->>Selector: ordered ids
    Command->>Batch: create with frozen selector snapshot
    Command->>Repo: insert batch and action items
    Command->>Jobs: enqueue action job
    Command-->>UI: 202 action receipt
```

### 10.2 执行操作

```mermaid
sequenceDiagram
    autonumber
    participant Runner
    participant Job as ActionJob
    participant Repo as ActionRepository
    participant VoucherRepo as VoucherRepository
    participant Voucher
    participant Finance

    Runner->>Job: claimed action batch
    loop claim item chunk
        Job->>Repo: claim queued items skip locked
        loop item savepoint
            Job->>VoucherRepo: lock voucher
            Job->>Voucher: activate, disable, restore, extend or void
            opt void with remaining balance
                Job->>Finance: post void fact
            end
            Job->>VoucherRepo: save state and event
            Job->>Repo: mark item succeeded
        end
        Job->>Repo: update counters
    end
    Job->>Repo: complete batch
```

一个 Item 的业务状态不允许时，仅该 Item 失败并记录明确 code；批次继续处理其他券。

## 11. 到期处理

```mermaid
sequenceDiagram
    autonumber
    participant Scheduler
    participant Job as ExpiryJob
    participant Repo as VoucherRepository
    participant Voucher
    participant Finance
    participant Outbox

    Scheduler->>Job: periodic run
    loop keyset chunk
        Job->>Repo: claim expired nonterminal vouchers skip locked
        loop voucher
            Job->>Voucher: expire(now)
            Job->>Finance: post expiry remaining fact
            Job->>Repo: save state and event
            Job->>Outbox: voucher.expired
        end
    end
```

到期查询使用 `expires_at` 部分索引和固定 chunk，不扫描终态数据。单券失败不会阻止其他到期处理。

## 12. 查询投影

```mermaid
sequenceDiagram
    autonumber
    participant Business as Domain Transaction
    participant Outbox
    participant Relay
    participant Job as ProjectionJob
    participant Sources as Domain Tables
    participant Projection as searchdocument
    participant UI as Voucher Search

    Business->>Outbox: append versioned event in same transaction
    Relay->>Job: enqueue projection event
    Job->>Sources: load authoritative facts by ids
    Sources-->>Job: customer/product/order/voucher facts
    Job->>Projection: upsert if event version newer
    UI->>Projection: indexed keyset query
    Projection-->>UI: flattened rows
```

投影幂等键为 event id；`projection_version` 防止乱序旧事件覆盖新状态。

### 12.1 卡券查询

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI as Search Page
    participant Query as SearchVouchers
    participant Search as PgVoucherSearch
    participant DB as searchdocument

    Operator->>UI: 设置 17+ 筛选条件
    UI->>Query: normalized filters + cursor
    Query->>Search: search specification
    Search->>DB: indexed keyset query
    DB-->>Search: page + next cursor
    Search-->>UI: voucher summaries
```

### 12.2 单券详情与时间线

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI
    participant Detail as GetVoucher
    participant Timeline as GetTimeline
    participant Repo

    Operator->>UI: 打开详情
    par 详情
        UI->>Detail: voucher id
        Detail->>Repo: projection + authoritative balance
        Repo-->>UI: detail
    and 时间线
        UI->>Timeline: voucher id + cursor
        Timeline->>Repo: status events + redemptions + reversals
        Repo-->>UI: ordered timeline
    end
```

详情中的当前余额从权威 Voucher 表读取；名称等展示字段可来自投影。两者返回各自版本，UI 不自行合并冲突状态。

## 13. 导出

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI
    participant Command as CreateExport
    participant Reporting
    participant Worker as ExportJob
    participant Search as VoucherSearch
    participant Objects as ObjectStore

    Operator->>UI: 导出当前筛选
    UI->>Command: report type + normalized filter snapshot
    Command->>Reporting: create export job
    Command-->>UI: 202 export receipt
    loop keyset pages
        Worker->>Search: read next page
        Search-->>Worker: rows
        Worker->>Worker: stream encode
    end
    Worker->>Objects: finalize file
    Worker->>Reporting: complete with object reference
    UI->>Reporting: poll export status
    Reporting-->>UI: completed file receipt
```

## 14. 封面上传

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI
    participant API as Cover Upload
    participant Objects
    participant Order as UpdateOrder

    Operator->>UI: 选择 JPG/PNG
    UI->>API: upload object
    API->>Objects: store immutable object
    Objects-->>API: ref + hash + metadata
    API-->>UI: upload receipt
    UI->>Order: save cover ref and hash in draft
```

删除重传只移除草稿引用；对象清理由统一对象生命周期任务根据未引用对象处理，不在浏览器直接删除任意对象。

## 15. 失败与恢复矩阵

| 失败点 | 事务结果 | 恢复方式 |
|---|---|---|
| 客户或产品命令失败 | 全部回滚 | 修正输入后以新幂等键重试 |
| KMS 在生成 chunk 前失败 | chunk 不提交 | JobRunner 重试 |
| KMS 部分加密失败 | chunk 不提交 | 同一 sequence 计划重试 |
| 导入单行错误 | 成功行继续，错误行记录 | 下载错误报告后新建导入 |
| 审批决定写入失败 | 决定不存在 | 相同幂等键安全重放 |
| 审批事件分发失败 | 审批已完成，Outbox 未发布 | OutboxRelay 重试 |
| 订单提交失败 | 备券、凭证和订单全部回滚 | 重试命令 |
| IssueItem 业务失败 | Item failed，其他 Item 可成功 | 修复原因后批次重试 |
| IssueJob 进程退出 | 已提交 Item 保留，running lease 到期 | JobRunner 重新认领 |
| Finance 发行事实失败 | 最终完成事务不提交 | 重试最后 chunk |
| 投影失败 | 写模型已成功 | ProjectionJob 重试或重建单券投影 |
| 导出失败 | 业务数据不受影响 | 重试导出任务 |
| 到期单券失败 | 该券保留原状态并记录错误 | 下一轮重试 |

## 16. 模块内部数据流总表

| 模块 | 输入 | 领域处理 | 持久化 | 输出 |
|---|---|---|---|---|
| 客户 | Customer DTO | Customer aggregate | partner/customer/contact | Customer receipt + event |
| 产品 | Product rule | VoucherProduct + type strategy | product/version | Product receipt + event |
| 卡号库 | Generation/import plan | CredentialPool + generator | pool/credential/job | Job receipt + event |
| 备券 | Customer/product/count | StockRequest | stock/revision | Stock receipt + approval subject |
| 审批 | Decision DTO | ApprovalInstance | instance/step/decision | Approval event |
| 卡券订单 | Sales and issue plan | IssueOrder + IssuePlanner | order/batch/items | Batch receipt |
| 发行 | IssueItem | Voucher type strategy + Voucher | credential/voucher/events | Issued event + finance fact |
| 激活绑定 | User credential | Credential lookup + Voucher | voucher/events | Member voucher receipt |
| 券操作 | Selector + action | ActionBatch + VoucherPolicy | action items/voucher/events | Progress and result |
| 核销 | Tender/verification | Voucher + Redemption | hold/redemption/voucher/event | Finance fact |
| 冲正 | Redemption + amount | Redemption + Voucher | reversal/redemption/voucher/event | Finance fact |
| 查询 | Filter specification | Query service | searchdocument/events | Keyset pages |
| 导出 | Filter snapshot | Reporting job | export job/object | File receipt |
