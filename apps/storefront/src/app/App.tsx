import { ErrorBoundary } from './ErrorBoundary';
import { QueryRuntime } from './QueryRuntime';
import { SessionRuntime } from './SessionRuntime';
import { Router } from '../route/Router';
import { BrowserRouter } from 'react-router';

export function App() {
  return (
    <ErrorBoundary>
      <QueryRuntime>
        <SessionRuntime>
          <BrowserRouter>
            <Router />
          </BrowserRouter>
        </SessionRuntime>
      </QueryRuntime>
    </ErrorBoundary>
  );
}
