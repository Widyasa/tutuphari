"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { BottomNav, IconSettings, SidebarNav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import type { Dest } from "@/lib/flow";

export function AppShell({
  warungName,
  dest,
  flowTitle,
  flowMeta,
  inFlow,
  showNav,
  demoLabel,
  offline,
  readNotice,
  saveFailed,
  notice,
  onBack,
  onDest,
  onSettings,
  children,
  footer,
}: {
  warungName: string;
  dest: Dest;
  flowTitle?: string;
  flowMeta?: string;
  inFlow: boolean;
  showNav: boolean;
  demoLabel: string | null;
  offline: boolean;
  readNotice: string | null;
  saveFailed: boolean;
  notice: string | null;
  onBack: () => void;
  onDest: (dest: Dest) => void;
  onSettings: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      id="app-shell"
      className="desk-shell pad-shell text-foreground pt-[env(safe-area-inset-top)] lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:items-stretch lg:gap-0 lg:p-0"
      style={{ minHeight: "calc(100dvh - var(--kb))" }}
    >
      <aside className="desk-nav sticky top-7 hidden h-fit flex-col border border-border bg-card p-3 lg:flex">
        <p className="px-3.5 pt-2 pb-1 text-lg font-bold tracking-[-0.02em] text-primary">TutupHari</p>
        <p className="px-3.5 pb-4 text-xs text-muted-foreground">{warungName}</p>
        <SidebarNav dest={dest} onDest={onDest} />
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={onSettings}>
          Pengaturan
        </Button>
      </aside>

      <div className="desk-pane flex min-w-0 flex-col" style={{ minHeight: "calc(100dvh - var(--kb))" }}>
        {inFlow ? (
          <header className="flex items-center gap-2 px-4 py-3 md:px-6 lg:px-0">
            <Button type="button" variant="outline" size="icon" aria-label="Kembali" className="bg-card/80" onClick={onBack}>
              <ArrowLeft />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-tight tracking-[-0.02em]">{flowTitle}</p>
              <p className="text-xs text-muted-foreground">{flowMeta}</p>
            </div>
            <IconSettings onClick={onSettings} className="lg:hidden" />
          </header>
        ) : (
          <header className="flex items-center justify-between px-4 py-3 md:px-6 lg:hidden">
            <div>
              <p className="text-lg font-bold tracking-[-0.02em] text-primary">TutupHari</p>
              <p className="text-xs text-muted-foreground">{warungName}</p>
            </div>
            <IconSettings onClick={onSettings} />
          </header>
        )}

        {demoLabel && (
          <p className="demo-banner mx-4 mb-3 rounded-lg border border-border bg-muted/80 px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--warn-ink)] uppercase md:mx-6 lg:mx-0">
            {demoLabel}
          </p>
        )}
        {offline && (
          <p className="mx-4 mb-2 rounded-lg border border-border bg-card/90 px-3 py-2 text-sm md:mx-6 lg:mx-0" data-testid="offline-banner">
            Kamu sedang offline. AI tidak tersedia. Catatan baru dibaca di HP ini, tanpa AI.
          </p>
        )}
        {readNotice && (
          <p className="px-4 py-2 text-sm text-muted-foreground md:px-6 lg:px-0" data-testid="read-label">
            {readNotice}
          </p>
        )}
        {saveFailed && (
          <p className="px-4 py-2 text-sm text-[var(--short)] md:px-6 lg:px-0">
            HP ini menolak penyimpanan. Catatan bisa hilang kalau halaman ditutup.
          </p>
        )}
        {notice && (
          <p className="px-4 py-2 text-sm md:px-6 lg:px-0" aria-live="polite">
            {notice}
          </p>
        )}

        <main
          className={
            inFlow
              ? "flow-desk w-full flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 md:px-6 lg:px-0"
              : "w-full flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 md:px-6 lg:px-0"
          }
        >
          {children}
        </main>

        {footer}

        {showNav && <BottomNav dest={dest} onDest={onDest} />}
      </div>
    </div>
  );
}

export function FlowFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 z-20 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 lg:static lg:border-0 lg:bg-transparent lg:px-0">
      <div className="flex w-full flex-col gap-2 md:mx-auto md:max-w-xl lg:mx-0 lg:max-w-xl">{children}</div>
    </footer>
  );
}
