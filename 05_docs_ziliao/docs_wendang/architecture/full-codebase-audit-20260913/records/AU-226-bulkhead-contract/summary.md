# AU-226｜Commerce Bulkhead contract 深审

Bulkhead通过Executor将外部HTTP执行接到`@shop/kernel`并发与队列隔离原语。静态运行消费者明确，无独立业务逻辑或P0–P3问题。
