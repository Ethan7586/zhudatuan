import type { ReactNode } from 'react';
import './Templates.css';

export function EditorWorkspace({ title, toolbar, outline, canvas, inspector, status }: Readonly<{ title: string; toolbar: ReactNode; outline: ReactNode; canvas: ReactNode; inspector: ReactNode; status?: ReactNode }>) {
  return <main className="shopworkspace" data-template="editor" aria-label={title}><header><h1>{title}</h1>{toolbar}</header><div className="shopeditor"><aside aria-label="页面结构">{outline}</aside><section aria-label="编辑画布">{canvas}</section><aside aria-label="属性设置">{inspector}</aside></div>{status}</main>;
}
