# SFL 身份域后置绑定根治

正式问题名称：**SFL 身份域后置绑定缺陷（Late Realm Binding）**。

## 目标模型

登录链路必须遵循：可信入口 → 固定 realm → 解析本 realm 账号与凭据 → 加载本 realm membership → 创建本 realm session → 签发本 realm ticket。手机号只是在指定 realm 内的登录名，不能决定节点、管理面或消费面。

`realm` 采用可扩展结构，核心字段是 `node_id`；登录上下文同时携带 `surface=admin|consumer`。当前 L0/L1 × admin/consumer 是首轮四入口验收矩阵，不是容量上限。底座目标是支持 L0–L11 每个节点独立账号，新增节点不得重做账号表结构或登录算法。

## 第 1 批已落地规则

- 后端只根据请求 Host 的入口映射确定 `node_id`，再用明确 target 确定 surface；`target`、`application`、`client`、`admin_origin` 均不能单独决定 node。
- 密码、OTP 与 JSAPI 微信交换在凭据校验或微信 code 交换前固定 realm。
- membership 查询同时绑定 realm 的 storage client 与 organization；当前 realm 没有 membership 时明确返回 `REALM_MEMBERSHIP_NOT_FOUND`，不尝试其他节点或 surface。
- session 只使用已通过 realm 筛选的 membership；ticket 保存 realm 对应的完整 L0/L1 return target，继续使用既有签名机制。
- `accounts.zhudatuan.com` 只生成 L0 API/Console 目标，`accounts.hbbtzn.com` 只生成 L1 API/Console 目标；陈旧跨节点参数只能恢复为当前 Host 本域。
- 构建缺少明确 API、Console、Storefront 或客户端版本配置时继续硬失败，不回退到另一节点。

## 第 1 批边界

本批关闭的是当前入口与 membership 串域风险，尤其是 `console-hbbtzn → console` 折叠后误选 L0 operator membership 的风险。它没有改变全局 principal、credential 唯一键、credential_version 或账号生命周期，因此尚不能宣称节点账号模型已经完成。

后续批次依次落地节点 realm registry 与 realm account、节点级凭据/验证生命周期、显式 realm/account session 与授权，以及生产迁移和扩展性验收。跨节点访问只能使用 Ethan 明确定义的显式授权或委派记录，不能自动查找其他节点的可用账号。

## 第 2 批数据模型

- `identity.realm` 是节点身份域注册表；`identity.realmentry` 登记可信 Host，`identity.realmtarget` 登记 surface、target、membership client/organization、application 与固定返回 origin。新增 L2–L11 通过插入登记数据完成，不增加节点枚举列。
- `identity.account` 是节点账号生命周期所有者，独立保存 `status`、`credential_version`、`assurance_level` 与版本时间。`legacy_principal_id` 仅用于迁移关联，不能作为跨节点授权依据。
- `identity.credential` 通过 `account_id + realm_id` 归属节点账号，唯一性改为 `realm_id + provider + subject_hash`；同一登录名可以跨 realm 共存。
- `access.membership` 与 `identity.federatedidentity` 增加 account/realm 归属。迁移只回填由 L0/L1 已确认 organization 可以确定的数据，未确认历史数据保持未归类，不伪造节点。
- 本批建立模型与确定性回填，运行时注册、改密、重置、短信和微信生命周期切换留在第 3 批。

## 第 3 批账号生命周期

- 注册、密码登录与短信登录先由可信 Host 查询 `identity.realmentry`，随后只在该 realm 内查找或创建 `identity.account` 与 `identity.credential`。手机号和账号名的唯一性边界是 realm；相同手机号可在不同节点拥有不同 account、principal、密码和 credential version。
- 手机密文、检索 token、掩码与验证时间由 `identity.account` 保存。`member.profile` 中的历史手机字段只作为迁移来源和兼容投影，不再用于身份解析、冲突判断或 Step-Up 目的地址选择。
- `identity.challenge`、`identity.assurance`、`identity.loginattempt` 和 `identity.federatedidentity` 均可记录 realm/account。新建登录、重置、手机变更、Step-Up 与微信记录必须带本域归属；共享 principal 的模糊历史记录不猜测回填。
- 改密、重置、手机变更、成员释放、验证失效和微信绑定只更新目标 account，并只撤销该 account 所属 membership 的 session。仅当 principal 不再关联任何 active account 时，才同步停用兼容 principal/profile。
- 微信 OpenID/UnionID 的查找、自动关联、绑定与重新绑定限制在当前 realm；绑定完成还必须匹配同一 account 的 active membership。
- `identity.realmtarget.target` 改为 realm 内键，可由不同节点复用 `console`、`storefront`、`store`、`supplier` 等通用 surface target。L2–L11 新节点通过 registry 数据加入，不需要新增节点枚举或修改登录算法。

第 3 批仍保留旧 session 表中的 principal 字段作为兼容桥；session、ticket、授权加载与撤销的显式 realm/account 切换属于第 4 批，不能提前宣称全链路根治完成。

## 第 4 批会话、票据与授权边界

- `identity.session` 显式保存 `realm_id`、`account_id` 和 realm 内 `auth_target`，并以复合外键同时绑定 account、membership 与 registry target。新建密码、短信、注册和微信 session 均写入这三个字段。
- `identity.resolve_session(token, entry_host)` 同时验证 Host registry、session、account、membership、target、credential version、access version 与 assurance 的 realm/account 一致性；不再通过 `member.profile + identity.principal` 推导登录账号。
- 运行时 Actor 投影携带 account/realm。权限、scope 和 capability 继续只以已由 session 固定的单一 membership 解析，不搜索共享 principal 的其他 membership。
- `identity.authticket` 显式保存 realm/account，并要求其 session 与 target 完全一致。兑换端先由请求 Host 固定 realm，再从 `identity.realmtarget.return_origin` 取得签名返回地址；运行时不再由静态节点表选择跳转 origin。
- 会话读取、单次注销、批量撤销、改密和手机变更均以 account/realm 为边界。历史 session 仅按其确定 membership 回填；无法分类者在迁移中撤销，对应未消费 ticket 同步作废。

本批关闭登录后的 session、ticket 与权限加载串域路径。第 5 批仍需完成 L0–L11 注册表扩展验收、四域端到端回归和总体验收，因此在第 5 批通过前仍不宣称全部根治完成。

## 第 5 批扩展与总体验收

- 认证页与商城页共用 `IdentityNodeRegistry` 数据契约。每个节点配置 `nodeId`、Accounts/API/Consumer API/Console/Storefront origin、admin/consumer target 与 storefront application；活动链路不再包含 L0/L1 条件分支。新增节点只投影 registry 数据，不修改身份业务算法。
- 浏览器首先按当前 Accounts Host 或 Storefront Host 选定唯一节点，再从同一条节点记录取得 API、target、application 和回跳 origin。未知 Host 不回退默认节点；Host 与 URL 参数不一致时入口无效。L0/L1 的既有 target 名称仅作为对应 registry 记录中的兼容数据。
- 完整迁移后的临时数据库实建 L0–L11 十二个 realm。十二个账号使用同一手机号检索值和同一微信 subject，但分别持有 account、密码 hash、credential version、手机验证、challenge、assurance、login attempt、federated identity、membership、session 和 ticket。
- 十二个 session 在各自 Host 下解析为 12 个精确 account/realm/membership，循环错位 Host 解析为 0 个；跨 realm 改写 ticket 被复合外键拒绝。L11 单独提升 credential version 后只失效 L11，L10 单独注销后只再失效 L10。
- L11 membership 的单独 deny 不出现在 L10 的授权快照中；跨节点权限仍只能来自未来由 Ethan 明确定义的显式授权或委派记录，本批没有引入自动共享。
- 最终回归覆盖 L0 admin、L0 consumer、L1 admin、L1 consumer 四入口，以及 registry-only L11 认证页和商城入口。认证前端 70 项、商城前端 343 项、身份后端关键链 65 项全部通过；共享 registry 契约测试覆盖 L0–L11。

至此，SFL 身份域后置绑定的五批根因修复在代码、受管迁移与本地完整回放范围内完成。生产部署不属于本次执行范围；在部署前仍以第 4 批提交作为本批回滚点，并按正式部署流程另行建立生产基线和外部十五域冒烟结果。
