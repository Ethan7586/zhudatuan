import type { Meta, StoryObj } from '@storybook/react-vite';
import { Brand } from './Brand';
import { token } from './Token';
import { ComponentSections } from './VI11StoryComponents';
import { FoundationSections } from './VI11StoryFoundation';
import './vi-1-1-story.css';

const meta = {
  title: 'VI 1.1 升級稿/完整設計板',
  parameters: { layout: 'fullscreen', controls: { disable: true } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function ViBoard() {
  return (
    <main className="v11board" data-sw-theme="light">
      <header className="v11hero">
        <div className="v11brand">
          <Brand inverse product="主打團 Product Design System" variant="mark" />
        </div>
        <div className="v11hero-copy">
          <p className="swoverline">Upgrade draft · 2026-08-28 · Asia/Shanghai</p>
          <h1>VI 1.1 完整細節升級稿</h1>
          <p>把 Console 已驗證的精緻度沉澱回 Canonical Design System：色彩、字級、圓角、陰影、圖層、Icon、Button、分割線、狀態與動效全部可追溯。</p>
        </div>
        <div className="v11meta">
          <span>
            Version <strong>{token.version}</strong>
          </span>
          <span>
            Status <strong>Upgrade Draft</strong>
          </span>
          <span>
            Owner <strong>Ethan</strong>
          </span>
        </div>
      </header>

      <FoundationSections />
      <ComponentSections />

      <footer className="v11footer">
        <span>Smart Wing Brand VI 1.0.0 → Zhudatuan Product Design System 1.1.0</span>
        <span>Upgrade Draft · 2026-08-28 20:37 CST</span>
      </footer>
    </main>
  );
}

export const FullSpecification: Story = { render: () => <ViBoard /> };
