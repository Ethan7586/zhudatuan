import { RouterProvider } from 'react-router/dom';
import { consoleRouter } from '../route/ConsoleRouter';

export function ConsoleApp() {
  return <RouterProvider router={consoleRouter} />;
}
