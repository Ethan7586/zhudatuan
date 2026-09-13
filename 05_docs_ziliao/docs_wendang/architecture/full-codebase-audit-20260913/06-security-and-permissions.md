# 全代码库系统审计｜06 身份、权限与凭据边界

## 1. 当前覆盖

本版只收录AU-005已核验的基础设施权限：Secret Store、KMS、Object Store、数据库连接角色和本地进程边界。用户登录、会话、Owner/管理员/成员业务授权将在后续身份专项逐链审阅。

审计未读取、打印或写入任何secret、token、master key、数据库连接串或对象签名实际值。

## 2. Secret Store / KMS 真实边界

~~~text
workload private env
  ├─ SECRET_STORE_BEARER_TOKEN → WorkloadSecretStore → loopback 8543/8553
  └─ KMS_BEARER_TOKEN          → KmsClient          → loopback 8544

expected server:
  health anonymous
  authenticate bearer → identify workload → require exact ref/keyRef → operation

actual bundled Main:
  health anonymous
  parse route/body → operation
~~~

[CONFLICT][E-AU-005-006] 客户端、授权Handler、WorkloadAccessPolicy和运行文档彼此一致，但build/systemd启动的Main没有调用授权链。staging systemd把policy作为credential注入，环境解析器也验证路径，Main仍忽略它。该问题记录为F-0021/P1候选并等待RV-0003；loopback监听只缩小网络面，不恢复workload授权。

## 3. 对象权限

- [FACT] Local Objects私有路由在Main中统一执行object bearer；`/health/ready`和带reference/expiry/HMAC的`/v1/public/*`例外。
- [FACT] public签名使用timing-safe比较且限制60–900秒；但签发URL固定为loopback，形成F-0025可用性/能力泄露边界。
- [CONFLICT] `scan=clean`没有实际scanner provenance，见F-0026。该字段不能作为已经执行内容安全检查的事实。
- [UNKNOWN] object token轮换、旧签名撤销窗口及云端Catalog OSS凭据owner未验证。

## 4. 数据库角色与上下文

- [FACT][E-AU-005-002] API、Jobs、Migration通过不同connection ref与pool profile连接；代码对期望role只在部分runtime启动时warning，最终权限仍由数据库role/RLS/function执行。
- [FACT] API/worker context在事务内设置；command用serializable和advisory lock。业务授权是否始终先于数据库写将在各模块专项复核。
- [UNKNOWN] 固定基线未连接生产数据库核对current_user、grant、RLS active状态；迁移文本不能替代live权限证据。

## 5. 本地进程隔离

- production内部服务主要使用同一`zhudatuan`用户并监听127.0.0.1；full staging使用独立DynamicUser、IPAddressAllow localhost和systemd credentials。
- [INFERENCE] production同主机进程隔离更依赖Bearer；因此F-0021不能因loopback或非root身份降为无影响。
- systemd的NoNewPrivileges、ProtectSystem、空capability及StateDirectory总体值得保留；它们与应用层ref授权是不同层次。

## 6. 未知项与执行纪律

master key备份、secret catalog生成/替换、token轮换、OSS账户策略和外部云权限不在仓库证据内。任何未来权限调整必须由Ethan明确授权，并从当时最新`zdt-next`建立独立修复分支；本审计文档不授权实施。

## 7. AU-006 配置完整性与凭据目的地

[FACT][E-AU-006-002] 专用服务环境parser多数会限制允许键、loopback bind、HTTPS endpoint、Manifest digest/ref，并要求Secret Store与KMS Bearer不同；这些是启动配置校验，不替代服务端身份/业务授权。

[CONFLICT][E-AU-006-005] Console per-node runtime的API与Identity URL只校验HTTPS，没有与同一Manifest的domain bindings绑定。浏览器随后：

- 把identityEntryUrl用于document redirect；
- 把apiBaseUrl交给SDK；
- SDK以credentials=include发请求，并可从shop_csrf cookie或业务上下文加入x-csrf-token、x-action-proof、scope和版本header。

因此runtime JSON的配置权力也包含“选择敏感请求接收方”的权力。当前没有读取线上JSON，也没有证明错误配置或泄露正在发生，故列为F-0029/P1候选而非P0，并等待RV-0007。

[CONFLICT][E-AU-006-006] SFL registry与Runtime Catalog嵌套对象可在同进程修改，可能使节点Host/ref或共享timeout随加载顺序漂移；固定基线未发现现有写调用，按P2记录F-0032。

本节只记录边界。没有新增权限门禁、没有读取凭据值、没有修改运行配置。

## 8. AU-007 Operation 权限契约

- [FACT][E-AU-007-002/004] `operations.yml` 是 Operation permission 的生成权威；generator 只验证 permission 存在于 PermissionCatalog。生成 Controller 把 permission 原样交给 AccessPipeline，数据库 capability 解算也按 Operation permission 绑定 membership grants。
- [CONFLICT][E-AU-007-004] `member.storefront.config.manage` 与 `member.storefront.custom.manage` 是实际写库入口，却都绑定 `member.read`。Console 的仅 read 测试上下文同时拥有这两个 manage capability，形成 F-0036/P1 候选并进入 RV-0008。
- [FACT][E-AU-007-009] `capabilities.yml` 不是运行授权事实源：它只参与 generator 的局部 audience 对照，数据库 capability 与 binding 由 Operations 生成；其 1 个孤儿、5 个 permission 漂移和 156 个缺口按 F-0041 记录。
- [UNKNOWN] 未读取线上角色、membership grants、entitlement 或真实请求日志，因此不能把 F-0036 写成已发生的越权事故，也不能用静态 fixture 证明线上无人可达。

本 AU 没有修改权限、凭据、会话或线上状态。

## 9. AU-008 proof 与跨域权限接缝

- [FACT][E-AU-008-005/006] `x-action-proof`由SDK显式透传，Finance policy和Owner transfer的Console调用会提供；proof值未被本审计记录。
- [CONFLICT] Console与API是不同origin，生产HttpApp的CORS预检白名单遗漏该头，真实请求在身份/业务授权之前被浏览器阻断；browser mock却允许。这是F-0044/P2可用性缺陷，不是授权绕过。
- 修复方向不得删除proof、缩短授权链或新增权限规则；只应在未来独立批次统一现有客户端/HTTP/mock头契约，并验证请求仍由既有AccessPipeline裁决。
- WechatTransport和release检查未发现凭据写入报告或制品的新证据；线上bundle与日志未读取，保持UNKNOWN。本AU未修改任何权限、凭据、会话或线上状态。
