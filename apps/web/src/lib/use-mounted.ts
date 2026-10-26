import { useSyncExternalStore } from "react";

const unsubscribe = () => {
  // Hydration snapshots have no external events to unsubscribe from.
};
const subscribe = () => unsubscribe;
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/** False during SSR/hydration, then true on the client for auth-dependent chrome. */
export const useMounted = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
