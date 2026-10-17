import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// React's `act()` is a no-op unless this flag is visible on the global object;
// without it every state update from a test event logs an act() warning.
const g = globalThis as unknown as {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
  window?: { IS_REACT_ACT_ENVIRONMENT?: boolean };
};

g.IS_REACT_ACT_ENVIRONMENT = true;

if (g.window) g.window.IS_REACT_ACT_ENVIRONMENT = true;
