import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Preloaded before any module: Radix decides DOM support at import time.
GlobalRegistrator.register({ url: "http://localhost/" });
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
