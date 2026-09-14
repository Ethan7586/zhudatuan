# AU-144｜Voucher 兼容入口与覆盖闭合深审

Voucher 的 root/legacy 目录保存旧分层 import 与 public contract stability。13 个文件是单向 re-export；根 `VoucherPort.ts` 是唯一有逻辑的 compatibility wrapper，它向旧 caller 提供默认 `FinancePort` 注入，并继承已审的 layered adapter。该 wrapper 仍由 Checkout、Order、Payment、Verification 与测试直接或经 public index 使用。

全部 14 个 Voucher 剩余文件已获得文件级状态；它们均归类 G0，不构成删除候选。Voucher 目录 47/47 基线文件完成覆盖。未发现 P0–P3 新问题；无适用新增测试。
