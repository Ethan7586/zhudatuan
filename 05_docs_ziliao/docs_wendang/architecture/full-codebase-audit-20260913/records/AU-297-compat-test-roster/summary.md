# AU-297｜Compatibility 角色测试账号名册

该 migration 建立 25 个 buyer/seller/ops/customer-service/admin 测试身份，以及各自 role、membership、scope、零余额钱包和 legacy user_roles 投影。生产授权仍只读取 membership_roles；user_roles 仅供历史读取兼容。测试代码交叉验证每个角色映射的数据库 membership、target 和权限。

测试口令 `123456` 位于 commerce-api local-only fixture，只有 `development+development` 或 `test+test` 同时成立才加载，生产 `getDemoAccounts` 返回空。该名册是隔离 Compatibility 测试数据库的验收契约与历史兼容资产，分类 G0，不得依据名称或口令字面值删除。未发现 P0–P3 新问题。
