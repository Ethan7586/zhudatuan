import { createRoot } from 'react-dom/client';
import { bootstrapApplication } from '@shop/design';
import '@shop/design/token/Tokens.css';
import '@shop/design/token/Base.css';
import '@shop/design/template/Workspace.css';
import '@shop/design/template/WorkspaceShell.css';
import '@shop/design/template/OperatorWorkspace.css';

const root = document.getElementById('root');
if (root === null) throw new Error('APP_ROOT_MISSING');
const renderer = createRoot(root);
void bootstrapApplication(
  () => import('./app/providers'),
  (application) => renderer.render(application)
);
