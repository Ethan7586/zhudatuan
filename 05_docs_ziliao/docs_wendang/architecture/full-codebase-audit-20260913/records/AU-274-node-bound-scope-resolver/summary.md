# AU-274｜NodeBoundScopeResolver 深审

resolver先取下游scope；普通scope直接校验node scope ID，owner scope先映射至owner节点scope再校验。fixture覆盖同节点、跨节点和缺失owner mapper。无P0–P3新问题。
