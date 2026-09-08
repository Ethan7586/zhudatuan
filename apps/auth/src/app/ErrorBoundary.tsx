import { Component, type ErrorInfo, type ReactNode } from 'react';
import { presentError, type FailureView } from '@shop/presentation';
import { Alert } from '../shared/view/Alert';
import { AuthCard } from '../shell/AuthCard';
import { AuthShell } from '../shell/AuthShell';

export class ErrorBoundary extends Component<Readonly<{ children: ReactNode }>, Readonly<{ failure?: FailureView }>> {
  override state: Readonly<{ failure?: FailureView }> = {};
  static getDerivedStateFromError(cause: unknown) {
    return { failure: presentError(cause) };
  }
  override componentDidCatch(_cause: unknown, _info: ErrorInfo): void {}
  override render() {
    if (!this.state.failure) return this.props.children;
    return (
      <AuthShell>
        <AuthCard stage={1} onBack={() => undefined}>
          <Alert failure={this.state.failure} onAction={() => window.location.reload()} />
        </AuthCard>
      </AuthShell>
    );
  }
}
