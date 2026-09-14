# AU-213｜Commerce Command message contract 深审

Command为所有CommandBus handler及execute输入提供仅含stable type的泛型消息契约。API/Jobs bootstrap实际消费其bus；接口不独立运行，且不构成删除候选。无P0–P3问题。
