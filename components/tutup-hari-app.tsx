"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CatatScreen } from "@/components/catat-screen";
import { OpenScreen } from "@/components/open-screen";
import { RiwayatScreen } from "@/components/riwayat-screen";
import { TutupScreen } from "@/components/tutup-screen";
import { closeDay } from "@/lib/calculator";
import { CASH_DISCLAIMER } from "@/lib/copy";
import { extractNote } from "@/lib/client-api";
import { createDay } from "@/lib/day";
import { formatLongDate } from "@/lib/dates";
import { createDemoDay } from "@/lib/demo";
import { createId } from "@/lib/id";
import { formatRupiah } from "@/lib/rupiah";
import { emptyStore } from "@/lib/storage";
import { useBook } from "@/lib/use-book";
import type { DayRecord, Store } from "@/lib/types";

type Tab = "catat" | "tutup" | "riwayat";

export function TutupHariApp() {
  const { store, setStore } = useBook();
  const [tab, setTab] = useState<Tab>("catat");
  const [readingId, setReadingId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function commit(next: Parameters<typeof setStore>[0]) {
    const saved = setStore(next);
    setSaveFailed(!saved);
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => {
      setNotice((current) => (current === message ? null : current));
    }, 2800);
  }

  function updateActive(recipe: (day: DayRecord) => DayRecord) {
    commit((current) => {
      if (!current.active) return current;
      const active = recipe(current.active);
      const history = active.closedAt
        ? [active, ...current.history.filter((day) => day.id !== active.id)].slice(0, 90)
        : current.history;
      return { version: 1, active, history };
    });
  }

  function archive(current: Store): DayRecord[] {
    if (!current.active) return current.history;
    if (current.active.notes.length === 0 && !current.active.closedAt) {
      return current.history.filter((day) => day.id !== current.active?.id);
    }
    return [current.active, ...current.history.filter((day) => day.id !== current.active?.id)].slice(0, 90);
  }

  if (!store.active) {
    return (
      <OpenScreen
        onStart={(warungName, modalAwal) => {
          commit((current) => ({
            version: 1,
            active: createDay({ warungName, modalAwal }),
            history: current.history,
          }));
          setTab("catat");
        }}
        onDemo={() => {
          const day = createDemoDay();
          commit((current) => ({
            version: 1,
            active: day,
            history: current.history.filter((item) => item.id !== day.id),
          }));
          setTab("catat");
        }}
      />
    );
  }

  const day = store.active;
  const result = closeDay({
    modalAwal: day.modalAwal,
    entries: day.entries,
    countedCash: day.countedCash,
    countedQris: day.countedQris,
  });

  async function send(text: string) {
    const noteId = createId();
    const dayId = day.id;
    setReadingId(noteId);
    commit((current) => {
      if (current.active?.id !== dayId) return current;
      return {
        ...current,
        active: {
          ...current.active,
          notes: [
            ...current.active.notes,
            { id: noteId, text, createdAt: new Date().toISOString() },
          ],
        },
      };
    });
    const extracted = await extractNote(text);
    setReadingId((current) => (current === noteId ? null : current));
    commit((current) => {
      if (current.active?.id !== dayId) return current;
      return {
        ...current,
        active: {
          ...current.active,
          notes: current.active.notes.map((note) =>
            note.id === noteId ? { ...note, warning: extracted.warning } : note,
          ),
          entries: [
            ...current.active.entries,
            ...extracted.entries.map((entry) => ({
              ...entry,
              id: createId(),
              noteId,
              status: "draft" as const,
            })),
          ],
        },
      };
    });
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <header className="sticky top-0 z-30 border-b border-border bg-background px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-primary">TutupHari</h1>
            <p>
              {day.warungName}
              {day.place ? `, ${day.place}` : ""} · {formatLongDate(day.date)}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setConfirmNew(true)}>
            Hari baru
          </Button>
        </div>
        <p className="mt-2 text-sm" aria-live="polite">
          Seharusnya di laci{" "}
          <span className="money text-xl text-foreground">{formatRupiah(result.expectedCash)}</span>
          {result.pendingCount > 0 ? ` · ${result.pendingCount} belum dicek` : ""}
          {result.selisih != null
            ? ` · ${result.verdict === "pas" ? "pas" : result.verdict === "kurang" ? "kurang" : "lebih"} ${formatRupiah(Math.abs(result.selisih))}`
            : ""}
        </p>
        <p className="mt-1 text-sm">{CASH_DISCLAIMER}</p>
        {day.isDemo && (
          <p className="mt-2 rounded-lg bg-warn px-3 py-2 text-sm font-bold text-warn-ink">
            CONTOH · Warung Bu Komang, Denpasar. Bukan transaksi sungguhan.
          </p>
        )}
        {saveFailed && (
          <p className="mt-2 text-sm text-short">
            HP ini menolak penyimpanan. Catatan bisa hilang kalau halaman ditutup.
          </p>
        )}
        {notice && (
          <p className="mt-2 text-sm" aria-live="polite">
            {notice}
          </p>
        )}
      </header>

      <main
        id="isi"
        className={tab === "catat" ? "px-4 py-4 pb-64" : "px-4 py-4 pb-40"}
      >
        {tab === "catat" && (
          <CatatScreen
            day={day}
            readingId={readingId}
            onSend={send}
            onConfirm={(id, patch) =>
              updateActive((current) => ({
                ...current,
                entries: current.entries.map((entry) =>
                  entry.id === id
                    ? { ...entry, ...patch, status: "confirmed", needsConfirmation: false, question: null }
                    : entry,
                ),
              }))
            }
            onPatch={(id, patch) =>
              updateActive((current) => ({
                ...current,
                entries: current.entries.map((entry) =>
                  entry.id === id ? { ...entry, ...patch } : entry,
                ),
              }))
            }
            onDelete={(id) =>
              updateActive((current) => ({
                ...current,
                entries: current.entries.filter((entry) => entry.id !== id),
              }))
            }
            onConfirmClear={() =>
              updateActive((current) => ({
                ...current,
                entries: current.entries.map((entry) =>
                  entry.status === "draft" && !entry.needsConfirmation
                    ? { ...entry, status: "confirmed" }
                    : entry,
                ),
              }))
            }
          />
        )}
        {tab === "tutup" && (
          <TutupScreen
            day={day}
            onCountedCash={(countedCash) => updateActive((current) => ({ ...current, countedCash }))}
            onCountedQris={(countedQris) => updateActive((current) => ({ ...current, countedQris }))}
            onClose={() =>
              updateActive((current) => ({
                ...current,
                closedAt: current.closedAt ?? new Date().toISOString(),
              }))
            }
            onNotice={flash}
          />
        )}
        {tab === "riwayat" && (
          <RiwayatScreen
            active={day}
            history={store.history}
            onOpen={(next) => {
              commit((current) => ({
                version: 1,
                active: next,
                history: archive(current).filter((item) => item.id !== next.id),
              }));
              setTab(next.closedAt ? "tutup" : "catat");
            }}
            onDelete={(id) => {
              commit((current) => ({
                version: 1,
                active: current.active?.id === id ? null : current.active,
                history: current.history.filter((item) => item.id !== id),
              }));
            }}
            onDeleteAll={() => setConfirmWipe(true)}
          />
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
        aria-label="Bagian utama"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-3">
          <NavButton current={tab === "catat"} onClick={() => setTab("catat")}>
            Catat
          </NavButton>
          <NavButton current={tab === "tutup"} onClick={() => setTab("tutup")}>
            Tutup
          </NavButton>
          <NavButton current={tab === "riwayat"} onClick={() => setTab("riwayat")}>
            Riwayat
          </NavButton>
        </div>
      </nav>

      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Mulai hari baru?</DialogTitle>
            <DialogDescription className="text-base text-foreground">
              Hari yang sedang terbuka pindah ke riwayat. Kalau belum ditutup, selisihnya belum disimpan sebagai tutup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmNew(false)}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => {
                commit((current) => ({ version: 1, active: null, history: archive(current) }));
                setConfirmNew(false);
              }}
            >
              Ya, hari baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmWipe} onOpenChange={setConfirmWipe}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg">Hapus semua data di HP ini?</DialogTitle>
            <DialogDescription className="text-base text-foreground">
              Catatan, tutup hari, dan kasbon yang tersimpan di browser ini akan hilang.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmWipe(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                commit(emptyStore);
                setConfirmWipe(false);
                setTab("catat");
              }}
            >
              Hapus semua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NavButton({
  current,
  onClick,
  children,
}: {
  current: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={
        current
          ? "h-full w-full text-base font-bold text-primary"
          : "h-full w-full text-base font-medium text-foreground"
      }
    >
      {children}
    </button>
  );
}
