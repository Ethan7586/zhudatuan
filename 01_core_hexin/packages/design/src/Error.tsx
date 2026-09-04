export interface ErrorViewProps { readonly title?: string; readonly message: string; readonly retry?: () => void }

export function ErrorView({ title = '加载失败', message, retry }: ErrorViewProps) {
  return <section role="alert"><h2>{title}</h2><p>{message}</p>{retry === undefined ? null : <button className="shopbutton shopbuttondefault" type="button" onClick={retry}>重试</button>}</section>;
}
