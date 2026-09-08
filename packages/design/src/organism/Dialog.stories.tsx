import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent } from 'storybook/test';
import { Button } from '../atom/Button';
import { Dialog } from './Dialog';

const meta = {
  title: '交互原语/Dialog',
  component: Dialog,
  args: {
    open: false,
    title: '确认业务操作',
    children: null,
    onClose: () => undefined,
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function DialogExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button tone="primary" onPress={() => setOpen(true)}>
        打开确认框
      </Button>
      <Dialog open={open} title="确认业务操作" onClose={() => setOpen(false)}>
        <p>提交前请核对当前范围与业务编号。</p>
      </Dialog>
    </>
  );
}

export const Controlled: Story = {
  render: () => <DialogExample />,
  play: async () => {
    await userEvent.click(screen.getByRole('button', { name: '打开确认框' }));
    await expect(screen.getByRole('dialog', { name: '确认业务操作' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '关闭' }));
    await expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
};
