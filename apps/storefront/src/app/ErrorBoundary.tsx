import { Component, type ErrorInfo, type ReactNode } from 'react';
import { failure } from '@shop/presentation';

export class ErrorBoundary extends Component<{ readonly children: ReactNode }, { readonly error: Error | null }> {
  state = { error: null } as { readonly error: Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    const reported = failure(error);
    window.dispatchEvent(new CustomEvent('storefront:error', { detail: { kind: reported.kind, code: reported.code } }));
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main role="alert" className="storefrontloading">
        <h1>商城暂时无法显示</h1>
        <p>请刷新页面重试；若问题持续，请联系客服。</p>
        <button type="button" onClick={() => window.location.reload()}>
          重新加载
        </button>
      </main>
    );
  }
}
