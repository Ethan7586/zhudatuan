# AU-197｜Commerce API target routing tests 深审

两组测试证明身份target不会跨越顶层或业务router，且旧auth路径不会进入会话解析链。它们只验证路由选择，不替代下游业务行为测试；未发现P0–P3问题。
