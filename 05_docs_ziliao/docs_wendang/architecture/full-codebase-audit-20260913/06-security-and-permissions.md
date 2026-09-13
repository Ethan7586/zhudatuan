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
