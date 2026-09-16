# AU-121｜Channel 兼容路径与覆盖收口深审

旧英文目录下 23 个文件都只是 `export *` 兼容转发，分别指向已经深审的中文分层 command、port、query、domain、adapter、persistence、HTTP 与 job 实现。它们可能承接旧 import 或外部构建，归类 G0。

`ChannelCapabilities` 仅声明 `channel.read` 与 `channel.manage`。至此 Channel 64 个文件都有明确覆盖状态；未发现 P0–P3。
