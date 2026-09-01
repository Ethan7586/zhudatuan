import { createRoot } from 'react-dom/client';
import { bootstrapApplication } from '@shop/design';
import '@shop/design/tokens.css';
import '@shop/design/base.css';
import '@shop/design/components.css';
import '@shop/design/workspace.css';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('APP_ROOT_MISSING');
const renderer = createRoot(root);
void bootstrapApplication(() => import('./app/providers'), (application) => renderer.render(application));
