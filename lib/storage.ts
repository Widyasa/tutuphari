import type { Store } from "@/lib/types";

const KEY = "tutuphari.v1";

export const emptyStore: Store = { version: 1, active: null, history: [] };

export function loadStore(): Store {
  if (typeof window === "undefined") return emptyStore;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyStore;
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (parsed.version !== 1) return emptyStore;
    return {
      version: 1,
      active: parsed.active ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return emptyStore;
  }
}

export function saveStore(store: Store): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
