# AU-102｜Identity invitation 与后台成员管理操作深审

Operator invitation 被约束为授权 tenant 内唯一 mall storefront、单次手机号邀请和匹配治理角色；创建与撤销均验证 console capability、governance、scope、有效期、版本和运行单元范围。成员状态/资料更新重新读取 authoritative governance，并失效关联 session/权限。

发现 F-0164/P2：后台员工创建直接 hash trim 后的 username；登录端会 lowercase canonicalize。含大写的后台 username 因 credential subject hash 不同而不能登录。

结论：未发现 P0/P1 新问题。Vitest 未安装，未执行。
