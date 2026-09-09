import { MINIAPP_TOKEN } from '../generated/DesignBinding';

Component({
  options: { multipleSlots: true },
  data: { brandColor: MINIAPP_TOKEN.brand },
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
    actions: { type: Array, value: [] },
    commanding: { type: Boolean, value: false },
    commandMessage: { type: String, value: '' },
    commandError: { type: String, value: '' },
    custom: { type: Boolean, value: false },
  },
  methods: {
    retry() { this.triggerEvent('retry'); },
    signIn() { this.triggerEvent('signin'); },
    signOut() { this.triggerEvent('signout'); },
    selectMembership(event: unknown) { this.triggerEvent('selectmembership', detail(event, 'id')); },
    navigate(event: unknown) { this.triggerEvent('navigate', detail(event, 'path')); },
    selectRecord(event: unknown) { this.triggerEvent('selectrecord', eventDetail(event)); },
    changeAction(event: unknown) {
      const identifiers = detail(event, 'action');
      const name = detail(event, 'name').name;
      const value = inputValue(event);
      this.triggerEvent('actioninput', { key: `${identifiers.action}:${name}`, value });
    },
    submitAction(event: unknown) { this.triggerEvent('actionsubmit', detail(event, 'action')); },
  },
});

function detail(event: unknown, key: string): Readonly<Record<string, string>> {
  const target = event !== null && typeof event === 'object' ? Reflect.get(event, 'currentTarget') : undefined;
  const dataset = target !== null && typeof target === 'object' ? Reflect.get(target, 'dataset') : undefined;
  const value = dataset !== null && typeof dataset === 'object' ? Reflect.get(dataset, key) : undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) throw new Error('MINIAPP_DATASET_INVALID');
  return Object.freeze({ [key]: value });
}

function eventDetail(event: unknown): unknown {
  return event !== null && typeof event === 'object' ? Reflect.get(event, 'detail') : undefined;
}

function inputValue(event: unknown): string {
  const value = eventDetail(event);
  const input = value !== null && typeof value === 'object' ? Reflect.get(value, 'value') : undefined;
  if (typeof input !== 'string' || input.length > 2048) throw new Error('MINIAPP_INPUT_INVALID');
  return input;
}
