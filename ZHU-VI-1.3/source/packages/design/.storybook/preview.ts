import type { Preview } from '@storybook/react-vite';
import '../src/fonts.css';
import '../src/tokens.css';
import '../src/base.css';
import '../src/typography.css';
import '../src/workspace.css';
import '../src/components.css';

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
