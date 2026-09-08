Component({
  properties: {
    rows: { type: Array, value: [] },
    count: { type: Number, value: 0 },
  },
  methods: {
    select(event: unknown) {
      const target = event !== null && typeof event === 'object' ? Reflect.get(event, 'currentTarget') : undefined;
      const dataset = target !== null && typeof target === 'object' ? Reflect.get(target, 'dataset') : undefined;
      const key = dataset !== null && typeof dataset === 'object' ? Reflect.get(dataset, 'key') : undefined;
      if (typeof key === 'string' && key.length > 0 && key.length <= 512) this.triggerEvent('select', { key });
    },
  },
});
