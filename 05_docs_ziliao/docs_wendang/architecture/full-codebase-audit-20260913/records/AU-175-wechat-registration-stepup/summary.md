# AU-175｜Commerce API WeChat/registration/step-up compatibility auth 深审

WeChat、注册和step-up处理器使用服务端provider/RPC/session链，并在关键输入/limiter边界失败关闭。当前正式router未挂载其auth namespace，扩大DC-0048/G1而非删除或修复。未发现P0。
