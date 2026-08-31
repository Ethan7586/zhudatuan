import { RouterProvider } from 'react-router/dom';
import { createConsoleRouter } from '../route/Router';
import { RouteRegistry } from './RouteRegistry';

const consoleRouter = createConsoleRouter(RouteRegistry);

export function ConsoleApp() {
  return <RouterProvider router={consoleRouter} />;
}
