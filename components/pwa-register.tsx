"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const UPDATING_KEY = "tutuphari.sw-updating";

export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const waiting = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onInstalled = (worker: ServiceWorker) => {
      if (navigator.serviceWorker.controller) {
        waiting.current = worker;
        setUpdateReady(true);
        return;
      }
      worker.postMessage({ type: "SKIP_WAITING" });
    };

    const watch = (worker: ServiceWorker | null) => {
      if (!worker) return;
      if (worker.state === "installed") onInstalled(worker);
      else {
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed") onInstalled(worker);
        });
      }
    };

    const onController = () => {
      if (sessionStorage.getItem(UPDATING_KEY) !== "1") return;
      sessionStorage.removeItem(UPDATING_KEY);
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);

    let registration: ServiceWorkerRegistration | null = null;
    const onUpdateFound = () => watch(registration?.installing ?? null);
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      registration = reg;
      watch(reg.installing);
      watch(reg.waiting);
      reg.addEventListener("updatefound", onUpdateFound);
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  function acceptUpdate() {
    const worker = waiting.current;
    if (!worker) return;
    sessionStorage.setItem(UPDATING_KEY, "1");
    worker.postMessage({ type: "SKIP_WAITING" });
  }

  if (!updateReady) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
      data-testid="sw-update"
      role="status"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl border border-border bg-card p-3">
        <p className="flex-1 text-sm">
          Versi baru siap. Muat ulang setelah catatan ini aman. Data di HP ini tetap tersimpan.
        </p>
        <Button type="button" onClick={acceptUpdate}>
          Muat ulang
        </Button>
      </div>
    </div>
  );
}
