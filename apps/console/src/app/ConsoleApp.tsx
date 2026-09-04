import { useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import { createConsoleRouter } from '../route/Router';
import { useDependencies } from './DependencyContext';
import { RouteRegistry } from './RouteRegistry';

export function ConsoleApp() {
  const dependencies = useDependencies();
  const [router] = useState(() => createConsoleRouter(RouteRegistry, dependencies.session.port));
  return <RouterProvider router={router} />;
}
