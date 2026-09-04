export function lazyPort<TPort extends object>(load: () => Promise<TPort>): TPort {
  let pending: Promise<TPort> | undefined;
  const ready = () =>
    (pending ??= load().catch((cause: unknown) => {
      pending = undefined;
      throw cause;
    }));
  return new Proxy(Object.create(null) as TPort, {
    get: (_target, property) => {
      if (property === 'then') return undefined;
      return (...arguments_: readonly unknown[]) =>
        ready().then((port) => {
          const member = Reflect.get(port, property);
          if (typeof member !== 'function') throw new Error(`LAZY_PORT_METHOD_MISSING:${String(property)}`);
          const method = member as (...values: readonly unknown[]) => unknown;
          return method.apply(port, [...arguments_]);
        });
    },
  });
}
