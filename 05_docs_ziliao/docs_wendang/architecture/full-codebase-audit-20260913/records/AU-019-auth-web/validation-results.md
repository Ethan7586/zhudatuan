# AU-019 验证结果

- `npm test -- --reporter=dot`：127，`vitest: command not found`，源码未加载。
- `npm run lint`：127，`tsc: command not found`，源码未加载。
- 未安装依赖；未执行会写入`dist`的build。
- 静态入口、跨仓caller、release target、Caddy runtime route、Schema消费、CSS选择器与资源引用已交叉核对。
- P1候选F-0083仅证明“客户端接纳并消费任意HTTPS目的地”的代码能力；未访问live JSON，未证明事故正在发生。
