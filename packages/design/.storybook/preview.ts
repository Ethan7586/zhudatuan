import type { Preview } from '@storybook/react-vite';
import '../src/tokens.css';
import '../src/base.css';
import '../src/workspace.css';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import '../src/components.css';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import '../src/components.css';
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
