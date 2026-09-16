# AU-147｜Member 运营读取、自定义资料与双入口深审

审阅 Member 的运营/商城读取、自定义资料、profile/address composition、full module、Identity Registration selected module、manifest 与相关测试。Commerce 主应用注册完整 MemberModule；身份注册 API 只注册受限的 operator-read 与 custom-profile operation 集。

运营读取以治理子树或明确 mall scope 限定数据；storefront 读取以 membership、商城和 active node 关系建立范围。自定义资料配置、标签和值均以 `organization_id` 作数据所有权键，写入前校验字段定义/取值类型。地址管理在 KMS envelope 成功后才交给 checkout address port。没有发现 P0–P3 新问题。

定向 Vitest 未运行：审计 worktree 缺少 `vitest`，命令退出 127；未安装依赖。
