# AU-273｜AdministratorContextResolver 深审

解析器只接受console actor，并把数据库唯一管理员上下文与actor的membership/account/principal/realm/accessVersion逐项核对；角色、权限和segment scope均冻结。fixture覆盖成功与member/cross-realm拒绝。无P0–P3新问题。
