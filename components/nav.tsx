"use client";

import { BookOpen, Clock, Home, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dest } from "@/lib/flow";
import { cn } from "@/lib/utils";

export const DESTINATIONS: { id: Dest; label: string; icon: typeof Home }[] = [
  { id: "hari", label: "Hari Ini", icon: Home },
  { id: "kasbon", label: "Kasbon", icon: BookOpen },
  { id: "riwayat", label: "Riwayat", icon: Clock },
];

export function IconSettings({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button type="button" variant="outline" size="icon" aria-label="Pengaturan" className={className} onClick={onClick}>
      <Settings />
    </Button>
  );
}

export function NavButton({
  current,
  label,
  icon: Icon,
  onClick,
}: {
  current: boolean;
  label: string;
  icon: typeof Home;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
        current ? "font-bold text-primary" : "font-medium text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "absolute inset-x-6 top-0 h-0.5 rounded-full transition-opacity",
          current ? "bg-primary opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
      <Icon aria-hidden className="size-5" strokeWidth={current ? 2.4 : 2} />
      <span>{label}</span>
    </button>
  );
}

export function SidebarNav({ dest, onDest }: { dest: Dest; onDest: (dest: Dest) => void }) {
  return (
    <nav className="grid gap-1" aria-label="Bagian utama">
      {DESTINATIONS.map((item) => {
        const Icon = item.icon;
        const current = dest === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={current ? "page" : undefined}
            onClick={() => onDest(item.id)}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-base transition-colors",
              current
                ? "bg-accent font-bold text-foreground shadow-[inset_3px_0_0_var(--primary)]"
                : "font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-5" strokeWidth={current ? 2.4 : 2} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

export function BottomNav({ dest, onDest }: { dest: Dest; onDest: (dest: Dest) => void }) {
  return (
    <nav
      className="grid grid-cols-3 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(12_31_22_/_4%)] backdrop-blur-md lg:hidden"
      aria-label="Bagian utama"
    >
      {DESTINATIONS.map((item) => (
        <NavButton
          key={item.id}
          current={dest === item.id}
          label={item.label}
          icon={item.icon}
          onClick={() => onDest(item.id)}
        />
      ))}
    </nav>
  );
}
