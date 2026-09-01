import { lazy, Suspense } from 'react';

const CockpitRoute = lazy(async () => {
  const { Component } = await import('./CockpitRoute');
  return { default: Component };
});

export function CockpitBootstrapRoute() {
  return (
    <Suspense fallback={null}>
      <CockpitRoute />
    </Suspense>
  );
}
