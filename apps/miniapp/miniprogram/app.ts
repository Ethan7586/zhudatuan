import { createMiniappRuntime } from './runtime/MiniappRuntime';
import type { MiniappInstance } from './platform/Wechat';

App<MiniappInstance & { onLaunch(): void }>({
  onLaunch() {
    try {
      Object.assign(this, { runtime: createMiniappRuntime() });
    } catch (cause) {
      Object.assign(this, { startupError: cause });
    }
  },
});
