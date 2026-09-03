export interface ToastMessage { readonly id: string; readonly tone: 'info' | 'success' | 'warning' | 'danger'; readonly message: string }
export function ToastRegion({ messages, dismiss }: Readonly<{ messages: readonly ToastMessage[]; dismiss: (id: string) => void }>) {
  return <section className="toastregion" aria-label="通知" aria-live="polite">{messages.map((message) => <article key={message.id} data-tone={message.tone}><p>{message.message}</p><button type="button" aria-label="关闭通知" onClick={() => dismiss(message.id)}>×</button></article>)}</section>;
}
