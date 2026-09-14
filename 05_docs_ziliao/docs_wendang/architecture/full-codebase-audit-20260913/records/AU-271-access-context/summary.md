# AU-271｜AccessContext 深审

访问上下文类型把actor、membership、scope、governance与trace集中；request/scope node context以WeakMap绑定，所有关键消费者通过require helper fail-closed。无P0–P3新问题。
