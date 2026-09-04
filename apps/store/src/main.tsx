import { createRoot } from 'react-dom/client';
import { bootstrapApplication } from '@shop/design';
import '@shop/design/tokens.css';
import '@shop/design/base.css';
import '@shop/design/workspace.css';
import '@shop/design/shell.css';
import '@shop/design/operator.css';

const root = document.getElementById('root');
if (root === null) throw new Error('APP_ROOT_MISSING');
const renderer = createRoot(root);
void bootstrapApplication(
  () => import('./app/providers'),
  (application) => renderer.render(application)
);
