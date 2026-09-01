import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, type ReactNode } from 'react';
import { ConsoleApp } from './ConsoleApp';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

export function Providers() {
  return (
    <ConsoleAppBoundary>
      <QueryClientProvider client={queryClient}>
        <ConsoleApp />
      </QueryClientProvider>
    </ConsoleAppBoundary>
  );
}

interface ConsoleAppBoundaryState { readonly error: Error | null }

class ConsoleAppBoundary extends Component<Readonly<{ children: ReactNode }>, ConsoleAppBoundaryState> {
  override state: ConsoleAppBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): ConsoleAppBoundaryState { return { error }; }
  override render(): ReactNode {
    return this.state.error === null ? this.props.children : <main><section role="alert">
      <h2>应用运行异常</h2><p>{this.state.error.message}</p>
      <button className="shopbutton shopbuttondefault" type="button" onClick={() => this.setState({ error: null })}>重试</button>
    </section></main>;
  }
}
