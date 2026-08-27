import type { Preview } from '@storybook/react-vite';
import '../src/tokens.css';
import '../src/base.css';
import '../src/workspace.css';
<<<<<<< HEAD
import '../src/components.css';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

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
