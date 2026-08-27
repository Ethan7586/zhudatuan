export interface EmptyProps { readonly title: string; readonly description?: string }

export function Empty({ title, description }: EmptyProps) {
  return <section role="status"><h2>{title}</h2>{description === undefined ? null : <p>{description}</p>}</section>;
}
