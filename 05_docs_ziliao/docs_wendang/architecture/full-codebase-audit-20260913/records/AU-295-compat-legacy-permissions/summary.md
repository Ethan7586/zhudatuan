# AU-295｜Compatibility 旧式权限词汇退役

该 migration 删除三项冒号式历史权限的 role grant，且只对受影响 role 的 active membership 递增 `authz_version`，使既有 session 在下次请求时重新按清理后的角色图解算。重复执行在无已删 grant 时不改变 session，具备幂等性。

全仓运行代码检索未发现三项旧 permission 的消费；Compatibility API contract、demo 权限和 Canonical authz 均使用点分代码（如 `order.read`、`finance.reconcile`）。旧词仅留在早期定义迁移与本次退役迁移，承担历史清理责任，归类 G0，非删除候选。未发现 P0–P3 新问题。
