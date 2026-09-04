import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

if (typeof window !== 'undefined') Object.defineProperty(window, 'scrollTo', { configurable: true, value: () => undefined });

afterEach(() => cleanup());
