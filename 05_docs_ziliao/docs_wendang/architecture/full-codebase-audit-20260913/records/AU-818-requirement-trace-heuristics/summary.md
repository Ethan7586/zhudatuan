# AU-818｜需求追踪启发式映射

- 审阅范围：`RequirementTrace.ts`（131 行）及RequirementGenerator调用点。
- **F-0317/P2：** module由中文关键词首匹配决定；operation只在同owner、`/api/v1` candidates中按读/写方法取第一个；route/journey由静态模块表推导。它没有验证具体需求文本与API字段、真实router或测试语义的绑定。生成器将结果标为Designed，降低被误当上线证明的风险，但一旦作为计划/coverage输入仍可能错误归因。
- Generator的运行模式会写生成制品，未运行。文件为 **G0**，无删除依据。
