import { useMemo } from 'react';
import { environment } from '../config/Environment';
import { Router } from '../route/Router';
import { createDependencies } from './Dependencies';
import { ErrorBoundary } from './ErrorBoundary';

export default function App() {
  const dependencies = useMemo(() => createDependencies(environment), []);
  return (
    <ErrorBoundary>
      <Router dependencies={dependencies} />
    </ErrorBoundary>
  );
}
