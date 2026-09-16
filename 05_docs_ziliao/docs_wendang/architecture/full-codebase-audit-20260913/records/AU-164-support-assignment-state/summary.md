# AU-164｜Support assignment/SLA/ticket state 深审

Assignment 按 scope、skill、priority 与最小 load 决定，ticket write 采用锁和 version。close/reopen 在 stale version 时会先写 history 再失败，F-0187/P2 已记录。未发现 P0。
