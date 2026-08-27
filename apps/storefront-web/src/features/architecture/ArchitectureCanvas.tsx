import React, { useEffect, useRef, useState } from 'react';
import { ARCHITECTURE_LINKS, ARCHITECTURE_NODES, type ArchitectureNode } from './architectureModel';

const WIDTH = 1200;
const HEIGHT = 690;
const LAYER_COLORS = {
  client: ['#EAF1FF', '#1F5EFF'],
  edge: ['#E8F8F1', '#18A058'],
  service: ['#FFF4E8', '#FF7A00'],
  data: ['#F3EDFF', '#7C3AED'],
} as const;

function roundedRect(context: CanvasRenderingContext2D, node: ArchitectureNode, radius = 12) {
  context.beginPath();
  context.roundRect(node.x, node.y, node.width, node.height, radius);
}

function drawArrow(context: CanvasRenderingContext2D, from: ArchitectureNode, to: ArchitectureNode, label?: string) {
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height;
  const endX = to.x + to.width / 2;
  const endY = to.y;
  const middleY = (startY + endY) / 2;
  context.strokeStyle = '#94A3B8';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(startX, startY);
  context.bezierCurveTo(startX, middleY, endX, middleY, endX, endY - 7);
  context.stroke();
  context.fillStyle = '#94A3B8';
  context.beginPath();
  context.moveTo(endX, endY);
  context.lineTo(endX - 5, endY - 9);
  context.lineTo(endX + 5, endY - 9);
  context.closePath();
  context.fill();
  if (label) {
    context.font = '11px sans-serif';
    context.fillStyle = '#64748B';
    context.textAlign = 'center';
    context.fillText(label, (startX + endX) / 2, middleY - 5);
  }
}

function drawLayerLabel(context: CanvasRenderingContext2D, title: string, y: number, color: string) {
  context.fillStyle = color;
  context.font = '700 12px sans-serif';
  context.textAlign = 'left';
  context.fillText(title, 20, y);
  context.strokeStyle = `${color}35`;
  context.beginPath();
  context.moveTo(20, y + 10);
  context.lineTo(1180, y + 10);
  context.stroke();
}

export const ArchitectureCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ArchitectureNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const draw = () => {
      const ratio = window.devicePixelRatio || 1;
      const cssWidth = Math.max(680, host.clientWidth);
      const cssHeight = (cssWidth / WIDTH) * HEIGHT;
      canvas.width = cssWidth * ratio;
      canvas.height = cssHeight * ratio;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      context.setTransform((cssWidth / WIDTH) * ratio, 0, 0, (cssWidth / WIDTH) * ratio, 0, 0);
      context.clearRect(0, 0, WIDTH, HEIGHT);
      context.fillStyle = '#F8FAFC';
      context.fillRect(0, 0, WIDTH, HEIGHT);
      drawLayerLabel(context, '01 终端体验层', 38, '#1F5EFF');
      drawLayerLabel(context, '02 边缘接入与安全层', 185, '#18A058');
      drawLayerLabel(context, '03 核心业务服务层', 350, '#FF7A00');
      drawLayerLabel(context, '04 数据与治理层', 520, '#7C3AED');
      ARCHITECTURE_LINKS.forEach((link) => {
        const from = ARCHITECTURE_NODES.find((node) => node.id === link.from);
        const to = ARCHITECTURE_NODES.find((node) => node.id === link.to);
        if (from && to) drawArrow(context, from, to, link.label);
      });
      ARCHITECTURE_NODES.forEach((node) => {
        const [fill, stroke] = LAYER_COLORS[node.layer];
        context.shadowColor = '#0F172A12';
        context.shadowBlur = 10;
        context.shadowOffsetY = 4;
        roundedRect(context, node);
        context.fillStyle = fill;
        context.fill();
        context.shadowColor = 'transparent';
        context.strokeStyle = selected?.id === node.id ? '#0F172A' : stroke;
        context.lineWidth = selected?.id === node.id ? 3 : 1.5;
        context.stroke();
        context.textAlign = 'left';
        context.fillStyle = '#0F172A';
        context.font = '700 15px sans-serif';
        context.fillText(node.title, node.x + 15, node.y + 27);
        context.fillStyle = '#64748B';
        context.font = '12px sans-serif';
        context.fillText(node.subtitle, node.x + 15, node.y + 48);
      });
    };
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    draw();
    return () => observer.disconnect();
  }, [selected]);

  const selectNode = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const y = ((event.clientY - bounds.top) / bounds.height) * HEIGHT;
    setSelected(ARCHITECTURE_NODES.find((node) => x >= node.x && x <= node.x + node.width && y >= node.y && y <= node.y + node.height) ?? null);
  };

  return (
    <div ref={hostRef} className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
      <canvas ref={canvasRef} onClick={selectNode} className="block cursor-pointer" aria-label="智慧翼企业福利商城系统架构图" />
      {selected && (
        <div className="sticky left-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 text-xs text-slate-600">
          <strong className="text-slate-900">{selected.title}</strong>
          <span className="mx-2 text-slate-300">|</span>
          {selected.subtitle}
        </div>
      )}
    </div>
  );
};
