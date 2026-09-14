# AU-114｜Channel connection 与 sync run 读取链深审

完整 Channel API 与独立 Identity Registration API 都公开 connection、sync run 和 provider operation read。两条 connection/sync read 均按当前 access scope 过滤并采用 keyset 分页；connection 不返回 secret，只给 has_secret。

两运行单元分别保存相同 query/action 实现，形成 F-0168/P3：当前 SQL 等价，但将来字段、cursor 或脱敏策略容易漂移。未发现 P0–P2；未运行 Vitest。
