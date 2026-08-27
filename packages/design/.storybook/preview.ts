import type { Preview } from '@storybook/react-vite';
import '../src/tokens.css';
import '../src/base.css';
import '../src/workspace.css';

const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
