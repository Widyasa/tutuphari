"use client";

import { useCallback, useSyncExternalStore } from "react";
import { emptyStore, loadStore, saveStore } from "@/lib/storage";
import type { Store } from "@/lib/types";

let memory: Store = emptyStore;
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoaded(): Store {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    memory = loadStore();
  }
  return memory;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Store {
  return ensureLoaded();
}

function getServerSnapshot(): Store {
  return emptyStore;
}

export function useBook() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setStore = useCallback((next: Store | ((current: Store) => Store)) => {
    memory = typeof next === "function" ? next(ensureLoaded()) : next;
    const saved = saveStore(memory);
    emit();
    return saved;
  }, []);
  return { store, setStore };
}
