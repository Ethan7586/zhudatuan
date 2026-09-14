# AU-301｜Compatibility 动态会员码验证链

该迁移仅保存会员码 credential 的 SHA-256 哈希；签发须当前 active storefront membership、匹配的 authz version 及已验证电话，并以 membership advisory lock 撤销此前 active challenge 后签发 45 秒有效码。二维码路由测试进一步验证：原始 credential 不会传给数据库 RPC，也不以独立字段返回给调用方；扫描端会先哈希再请求核验。

核验 RPC 锁定 challenge，重新校验签发会员的身份、权限版本及电话状态，并要求核验者为同一 tenant、enterprise 和 mall 内具有管理身份的 active membership；challenge 状态只会原子地由 active 迁移为 consumed。挑战签发的每分钟上限属于会员码滥用控制，不纳入 F-0234 所定义的登录或注册限流冲突。

未发现新增 P0–P3 问题。因审计工作树缺少 Vitest 依赖，未执行该测试文件；以上结论基于迁移、路由和测试代码的静态调用链取证。
