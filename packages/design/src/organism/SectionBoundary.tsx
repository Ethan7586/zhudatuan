import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorView } from '../atom/Error';

export interface SectionBoundaryProps {
  readonly children: ReactNode;
  readonly title?: string;
  readonly report?: (error: Error, info: ErrorInfo) => void;
  readonly resetKey?: string | number;
}

interface SectionBoundaryState {
  readonly error: Error | null;
}

export class SectionBoundary extends Component<SectionBoundaryProps, SectionBoundaryState> {
  override state: SectionBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SectionBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.report?.(error, info);
  }

  override componentDidUpdate(previous: SectionBoundaryProps): void {
    if (this.state.error !== null && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return <ErrorView title={this.props.title ?? '此区域暂时无法显示'} message="其他内容仍可继续使用。请重试；若问题持续，请联系管理员并说明当前页面。" retry={() => this.setState({ error: null })} />;
  }
}
