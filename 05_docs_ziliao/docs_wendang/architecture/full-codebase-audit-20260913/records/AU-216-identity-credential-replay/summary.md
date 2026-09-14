# AU-216｜Commerce Identity credential replay test 深审

IdentityCredentialReplay以真实ModuleOperations 验证身份会话、票据和邀请的一次性响应不会持久化secret，重复key只能得到固定409。AU-218纠正：该文件不覆盖step-up action proof；其直接测试缺口见F-0212/P3。
