# AU-298｜Compatibility 支付模拟银行渠道修复

该 4 行 follow-up migration 仅重新声明 `payments.channel` 检查约束，补入 `bank`。上游测试支付模拟 RPC 接受 `bank_mock`，并通过 `replace('_mock','')` 写入底层 `bank`；没有该约束会在银行模拟混合支付时拒绝已声明的渠道。

它是已应用 initial simulation migration 的前向约束修复，承担测试数据回放兼容职责，分类 G0；不因文件很短或缺少直接 TypeScript import 删除。未发现 P0–P3 新问题；完整 simulation migration 和端到端数据库回放留后续单元。
