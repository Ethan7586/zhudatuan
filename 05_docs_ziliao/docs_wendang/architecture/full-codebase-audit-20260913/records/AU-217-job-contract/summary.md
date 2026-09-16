# AU-217｜Commerce Job contract 深审

Job及JobContext为全部后台任务提供统一ID、attempt、abort signal和异步执行形状。多个运行时与入口直接消费，真正的claim/retry由JobRunner/QueueJob承接。无P0–P3问题。
