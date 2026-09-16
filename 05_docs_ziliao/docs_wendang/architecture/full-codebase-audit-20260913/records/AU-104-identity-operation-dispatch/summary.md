# AU-104｜Identity operation dispatch 与公开目录深审

Identity full runtime 组合 session/ticket、registration、membership invitation、credential、mobile/WeChat 五组 actions，再按 immutable core operation list 选择；缺少被声明 action 会在装配期 fail-fast。registration runtime 使用受限 core list；带 WeChat 的注册 wrapper 另行追加两个 WeChat operation，避免 core-only runtime 意外公开。

目录测试锁定完整 ID、HTTP method/path、无重复分区与 registration ownership。综合测试对 session realm/account、治理、financial proof、operator invitation 和 registration notification 的查询行为提供 oracle。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
