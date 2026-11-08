"use client";

import { Banknote, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

export function MethodChoice({
  method,
  onMethod,
}: {
  method: "tunai" | "qris" | null;
  onMethod: (method: "tunai" | "qris") => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button
        type="button"
        aria-pressed={method === "tunai"}
        onClick={() => onMethod("tunai")}
        className={cn(
          "min-h-16 rounded-xl border bg-card px-3 py-2 text-sm font-bold text-[var(--ok)] shadow-[var(--surface-shadow)] transition-shadow",
          method === "tunai" ? "border-primary ring-2 ring-primary/30" : "border-[var(--ok)]/40",
        )}
      >
        <Banknote className="mx-auto mb-1 size-4" aria-hidden />
        Tunai
        <span className="mt-1 block text-xs font-medium">masuk laci</span>
      </button>
      <button
        type="button"
        aria-pressed={method === "qris"}
        onClick={() => onMethod("qris")}
        className={cn(
          "min-h-16 rounded-xl border bg-card px-3 py-2 text-sm font-bold text-[var(--qris)] shadow-[var(--surface-shadow)] transition-shadow",
          method === "qris" ? "border-[var(--qris)] ring-2 ring-[var(--qris)]/30" : "border-[var(--qris)]/40",
        )}
      >
        <QrCode className="mx-auto mb-1 size-4" aria-hidden />
        QRIS
        <span className="mt-1 block text-xs font-medium">bukan laci</span>
      </button>
    </div>
  );
}
