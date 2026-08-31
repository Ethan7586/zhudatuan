import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorView } from './Error';

interface AppBoundaryProps {
  readonly children: ReactNode;
  readonly report?: (error: Error, info: ErrorInfo) => void;
}
interface AppBoundaryState {
  readonly error: Error | null;
}

export class AppBoundary extends Component<AppBoundaryProps, AppBoundaryState> {
  override state: AppBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): AppBoundaryState {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.report?.(error, info);
  }
  override render(): ReactNode {
    return this.state.error === null ? (
      this.props.children
    ) : (
      <main>
        <ErrorView title="应用运行异常" message={this.state.error.message} retry={() => this.setState({ error: null })} />
      </main>
    );
  }
}
