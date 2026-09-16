# AU-281｜SessionResolver 深审

PgSessionResolver从已绑定request node获得host，以token hash查询会话；校验account/realm/membership client/governance organization及entry realm，再构造active node context。fixture覆盖node连续性、legacy projection拒绝和hosted membership node。无P0–P3新问题。
