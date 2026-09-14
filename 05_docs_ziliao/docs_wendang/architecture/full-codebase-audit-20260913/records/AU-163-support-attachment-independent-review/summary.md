# AU-163｜F-0186 Support attachment 独立复核

独立检查 API contract、SDK、Console feature caller、专用 entry allowlist、route wiring 与 operation response。operator GET 路径会无条件返回 attachment 元数据，而 attachment SQL 未以调用者 member/scope 过滤。结论与 AU-162 一致：F-0186/P1 确认；未发现 P0。
