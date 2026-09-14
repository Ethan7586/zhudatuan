# AU-110｜Capability entitlement 目录与管理深审

Capability read 限定当前 access scope，以 capability name/id keyset 返回 entitlement。manage 与公开 CapabilityPort 均以 scope 和 expected version 条件更新，后者被 ChannelRoutes 用于配额写入。manifest/public entry 只声明 read/manage HTTP operation。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
