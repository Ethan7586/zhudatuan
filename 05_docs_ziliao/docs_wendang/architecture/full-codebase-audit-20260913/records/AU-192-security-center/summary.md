# AU-192｜Commerce API security center compatibility 深审

安全中心 handler 具备password/OTP/PII/session边界，但当前 API entrypoint 把所有 auth path 固定为404。因旧客户端、文档、测试和公开导出仍在，归入DC-0048/G1；未覆盖的兼容写入分支记录F-0199/P2；未发现P0。
