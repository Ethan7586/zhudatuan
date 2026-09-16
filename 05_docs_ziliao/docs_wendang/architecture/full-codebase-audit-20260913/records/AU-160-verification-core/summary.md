# AU-160｜Verification challenge/device 深审

Verification challenge 只存 nonce hash，60 秒后过期；验证过程原子消费 nonce、记录 attempt，voucher 兑换写入 outbox。唯一测试只覆盖 manifest，F-0184/P2 记录 direct behavior 缺口。未发现 P0。
