# AU-272｜ActionProof 深审

动作证明在命令事务client内以SHA-256 bearer hash调用数据库consume函数，完整携带actor/session/membership/scope/operation/resource/idempotency/version/request hash；畸形proof或hash不触库。无P0–P3新问题。
