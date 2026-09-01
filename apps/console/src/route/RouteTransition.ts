import type { QueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router';

export async function transitionConsoleRoute(queryClient: QueryClient, navigate: NavigateFunction, target: string): Promise<void> {
  await queryClient.cancelQueries({ queryKey: ['console'] });
  await navigate(target);
}
