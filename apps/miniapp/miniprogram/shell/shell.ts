Component({
  options: { multipleSlots: true },
  properties: {
    title: { type: String, value: '' },
    description: { type: String, value: '' },
    state: { type: String, value: 'loading' },
    rows: { type: Array, value: [] },
    count: { type: Number, value: 0 },
    error: { type: String, value: '' },
    stale: { type: Boolean, value: false },
    authenticated: { type: Boolean, value: false },
    navigation: { type: Array, value: [] },
    memberships: { type: Array, value: [] },
  },
  methods: {
    retry() { this.triggerEvent('retry'); },
    signIn() { this.triggerEvent('signin'); },
    signOut() { this.triggerEvent('signout'); },
    selectMembership(event: unknown) { this.triggerEvent('selectmembership', detail(event, 'id')); },
    navigate(event: unknown) { this.triggerEvent('navigate', detail(event, 'path')); },
  },
});

function detail(event: unknown, key: string): Readonly<Record<string, string>> {
  const target = event !== null && typeof event === 'object' ? Reflect.get(event, 'currentTarget') : undefined;
  const dataset = target !== null && typeof target === 'object' ? Reflect.get(target, 'dataset') : undefined;
  const value = dataset !== null && typeof dataset === 'object' ? Reflect.get(dataset, key) : undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) throw new Error('MINIAPP_DATASET_INVALID');
  return Object.freeze({ [key]: value });
}
