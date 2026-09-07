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
