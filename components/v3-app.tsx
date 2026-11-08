"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppShell, FlowFooter } from "@/components/app-shell";
import { CatatPane, LoadingPane } from "@/components/screens/catat-pane";
import { DayContext } from "@/components/screens/day-context";
import { ExportPane } from "@/components/screens/export-pane";
import { FallbackPane } from "@/components/screens/fallback-pane";
import { HasilPane } from "@/components/screens/hasil-pane";
import { HitungPane } from "@/components/screens/hitung-pane";
import { HomePane } from "@/components/screens/home-pane";
import { KasbonPane } from "@/components/screens/kasbon-pane";
import { KonfirmasiPane } from "@/components/screens/konfirmasi-pane";
import { RiwayatPane } from "@/components/screens/riwayat-pane";
import { StartScreen } from "@/components/start-screen";
import { unclearChip } from "@/components/ui-tokens";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { closeDay } from "@/lib/calculator";
import { extractNote } from "@/lib/client-api";
import { createDay } from "@/lib/day";
import { draftConfirmBlock, normalizeDraftEdit } from "@/lib/draft-edit";
import { createDemoDay, createDemoHistory } from "@/lib/demo";
import { toCsv, toWhatsApp } from "@/lib/export";
import {
  backTarget,
  canCountDrawer,
  closeGate,
  progressOf,
  reduceNav,
  reviewBlockMessage,
  showsBottomNav,
  type Dest,
  type NavState,
  type Step,
} from "@/lib/flow";
import { createId } from "@/lib/id";
import { assessRepayment, kasbonBook } from "@/lib/kasbon";
import { parseMoneyInput } from "@/lib/rupiah";
import { emptyStore } from "@/lib/storage";
import type { DayRecord, Store } from "@/lib/types";
import { useBook } from "@/lib/use-book";

const NAV_KEY = "tutuphari.nav.v3";

export function V3App() {
  const { store, setStore } = useBook();
  const [nav, setNav] = useState<NavState>({ dest: "hari", step: null, draft: "" });
  const [saveFailed, setSaveFailed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [reading, setReading] = useState(false);
  const [fallbackText, setFallbackText] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] = useState<"tunai" | "qris">("tunai");
  const [notice, setNotice] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payName, setPayName] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const payLock = useRef(false);
  const [readNotice, setReadNotice] = useState<string | null>(null);
  const offline = !useSyncExternalStore(subscribeOnline, onlineSnapshot, serverOnline);
  const navRef = useRef(nav);
  useEffect(() => {
    navRef.current = nav;
  }, [nav]);

  useEffect(() => {
    const onChange = () => refreshNetwork();
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    refreshNetwork();
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--kb", `${Math.round(inset)}px`);
    };
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    sync();
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { th?: boolean; dest?: Dest; step?: Step | null } | null;
      if (!state?.th) return;
      setNav((current) => ({
        dest: state.dest ?? "hari",
        step: state.step ?? null,
        draft: current.draft,
      }));
    };
    window.addEventListener("popstate", onPop);
    let initial = navRef.current;
    try {
      const raw = sessionStorage.getItem(NAV_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NavState>;
        if (parsed.dest === "hari" || parsed.dest === "kasbon" || parsed.dest === "riwayat") {
          initial = {
            dest: parsed.dest,
            step: parsed.step ?? null,
            draft: typeof parsed.draft === "string" ? parsed.draft : "",
          };
        }
      }
    } catch {
      initial = navRef.current;
    }
    window.setTimeout(() => setNav(initial), 0);
    window.history.replaceState({ th: true, dest: initial.dest, step: initial.step }, "");
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function commit(next: Store | ((current: Store) => Store)) {
    const saved = setStore(next);
    setSaveFailed(!saved);
  }

  function updateActive(recipe: (day: DayRecord) => DayRecord) {
    commit((current) => {
      if (!current.active) return current;
      const active = recipe(current.active);
      const history = active.closedAt
        ? [active, ...current.history.filter((day) => day.id !== active.id)].slice(0, 90)
        : current.history.filter((day) => day.id !== active.id);
      return { version: 1, active, history };
    });
  }

  function persistNav(next: NavState) {
    try {
      sessionStorage.setItem(NAV_KEY, JSON.stringify(next));
    } catch {
      setSaveFailed(true);
    }
  }

  function navigate(next: NavState, mode: "push" | "replace" = "push") {
    setNav(next);
    persistNav(next);
    const payload = { th: true, dest: next.dest, step: next.step };
    if (mode === "push") window.history.pushState(payload, "");
    else window.history.replaceState(payload, "");
  }

  function setDraft(text: string) {
    const next = reduceNav(navRef.current, { type: "type", text });
    setNav(next);
    persistNav(next);
    updateActive((day) => ({ ...day, draftNote: text }));
    window.history.replaceState({ th: true, dest: next.dest, step: next.step }, "");
  }

  const day = store.active;

  if (!day) {
    return (
      <StartScreen
        onStart={(warungName, modalAwal) => {
          commit((current) => ({
            version: 1,
            active: createDay({ warungName, modalAwal }),
            history: current.history,
          }));
          navigate({ dest: "hari", step: "catat", draft: "" }, "push");
        }}
        onDemo={() => {
          const demo = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
          commit({
            version: 1,
            active: demo,
            history: createDemoHistory(),
          });
          navigate({ dest: "hari", step: null, draft: "" }, "replace");
        }}
      />
    );
  }

  const record = day;

  const result = closeDay({
    modalAwal: day.modalAwal,
    entries: day.entries,
    countedCash: day.countedCash,
    countedQris: day.countedQris,
  });
  const unclear = day.entries.filter((entry) => entry.method === "tidak_tahu");
  const tunaiMasuk = result.penjualanTunai + result.kasbonBayarTunai + result.setorTunai;
  const tunaiKeluar =
    result.pengeluaranTunai + result.ambilPribadiTunai + result.kasbonKeluarTunai + result.tarikTunai;
  const book = kasbonBook([day, ...store.history.filter((item) => item.id !== day.id)]);
  const activePeople = book.filter((row) => row.outstanding > 0);
  const kasbonTotal = activePeople.reduce((sum, row) => sum + row.outstanding, 0);
  const showNav = showsBottomNav(nav.step);
  const gate = closeGate(day.entries);
  const pendingCount = day.entries.filter(
    (entry) => entry.status !== "confirmed" || entry.needsConfirmation || entry.method === "tidak_tahu",
  ).length;

  function goDest(dest: Dest) {
    navigate(reduceNav(navRef.current, { type: "dest", dest }));
  }

  function goStep(step: Step | null) {
    navigate(reduceNav(navRef.current, { type: "step", step }));
  }

  function onBack() {
    if (window.history.state?.th) {
      window.history.back();
      return;
    }
    navigate(backTarget(navRef.current), "replace");
  }

  async function sendDraft(text: string) {
    if (!text || reading) return;
    const noteId = createId();
    const dayId = record.id;
    setReading(true);
    setFallbackText(text);
    navigate({ ...navRef.current, step: "loading" }, "replace");
    updateActive((current) => ({
      ...current,
      draftNote: text,
      notes: [...current.notes, { id: noteId, text, createdAt: new Date().toISOString() }],
    }));
    const extracted = await extractNote(text);
    setReading(false);
    setReadNotice(
      extracted.warning ?? (extracted.parser === "ai" ? "Dibaca dengan AI." : "Dipakai pembacaan di HP ini, tanpa AI."),
    );
    if (!extracted.entries.length) {
      setManualAmount("");
      setManualMethod("tunai");
      navigate({ ...navRef.current, step: "fallback", draft: text }, "replace");
      return;
    }
    commit((current) => {
      if (current.active?.id !== dayId) return current;
      const entries = [
        ...current.active.entries,
        ...extracted.entries.map((entry) => ({
          ...entry,
          id: createId(),
          noteId,
          status: "draft" as const,
        })),
      ];
      const active = {
        ...current.active,
        notes: current.active.notes.map((note) =>
          note.id === noteId ? { ...note, warning: extracted.warning } : note,
        ),
        entries,
        draftNote: "",
      };
      return { ...current, active };
    });
    navigate({ dest: navRef.current.dest, step: "konfirmasi", draft: "" }, "replace");
  }

  function chooseMethod(id: string, method: "tunai" | "qris") {
    updateActive((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== id) return entry;
        const amountMissing = entry.amount == null || entry.amount <= 0;
        return {
          ...entry,
          method,
          needsConfirmation: amountMissing || entry.type === "lainnya",
          question: amountMissing ? entry.question ?? "Nominalnya berapa?" : null,
        };
      }),
    }));
  }

  function ledgerDays() {
    return [record, ...store.history.filter((item) => item.id !== record.id)];
  }

  function confirmEntry(id: string) {
    if (record.closedAt) return;
    const entry = record.entries.find((item) => item.id === id);
    if (!entry || entry.status === "confirmed") return;
    if (draftConfirmBlock(entry, ledgerDays())) return;
    updateActive((current) => {
      if (current.closedAt) return current;
      return {
        ...current,
        entries: current.entries.map((item) =>
          item.id === id
            ? { ...item, status: "confirmed" as const, needsConfirmation: false, question: null }
            : item,
        ),
      };
    });
  }

  function updateDraft(id: string, patch: ReturnType<typeof normalizeDraftEdit>) {
    if (record.closedAt) return;
    updateActive((current) => {
      if (current.closedAt) return current;
      return {
        ...current,
        entries: current.entries.map((entry) =>
          entry.id === id && entry.status !== "confirmed"
            ? {
                ...entry,
                ...patch,
                sourceText: entry.sourceText,
                status: "draft" as const,
                needsConfirmation: false,
                question: null,
              }
            : entry,
        ),
      };
    });
  }

  function deleteDraft(id: string) {
    if (record.closedAt) return;
    updateActive((current) => {
      if (current.closedAt) return current;
      return {
        ...current,
        entries: current.entries.filter((entry) => !(entry.id === id && entry.status !== "confirmed")),
      };
    });
    window.setTimeout(() => document.getElementById("cek-heading")?.focus(), 0);
  }

  function saveManual() {
    const amount = parseMoneyInput(manualAmount);
    if (amount == null || amount <= 0) return;
    const text = fallbackText || nav.draft || "catatan manual";
    updateActive((current) => ({
      ...current,
      draftNote: "",
      notes: [
        ...current.notes,
        { id: createId(), text, createdAt: new Date().toISOString(), warning: "Diisi manual." },
      ],
      entries: [
        ...current.entries,
        {
          id: createId(),
          noteId: createId(),
          type: "penjualan",
          amount,
          method: manualMethod,
          item: null,
          qty: null,
          counterparty: null,
          confidence: 1,
          sourceText: text,
          needsConfirmation: false,
          question: null,
          parser: "rule",
          status: "draft",
        },
      ],
    }));
    navigate({ ...navRef.current, step: "konfirmasi", draft: "" }, "push");
  }

  function saveCount(raw: string) {
    const amount = parseMoneyInput(raw);
    updateActive((current) => ({ ...current, countedCash: amount }));
  }

  async function copyRecap() {
    const text = toWhatsApp(record);
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Teks rekap tersalin.");
    } catch {
      setNotice("Salin gagal. Pilih teksnya manual.");
    }
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(record)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tutuphari-${record.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function finishClose() {
    updateActive((current) => ({
      ...current,
      closedAt: current.closedAt ?? new Date().toISOString(),
    }));
    navigate({ dest: "hari", step: null, draft: navRef.current.draft }, "push");
  }

  function saveKasbonPayment() {
    const amount = parseMoneyInput(payAmount);
    const person = payName.trim();
    if (!person || amount == null || amount <= 0) return;
    if (payLock.current) return;
    const decision = assessRepayment({
      days: [record, ...store.history.filter((item) => item.id !== record.id)],
      person,
      amount,
    });
    if (!decision.ok) {
      setPayError(decision.message);
      setNotice(null);
      return;
    }
    payLock.current = true;
    setPayError(null);
    updateActive((current) => ({
      ...current,
      notes: [
        ...current.notes,
        {
          id: createId(),
          text: `${person} bayar kasbon ${amount}`,
          createdAt: new Date().toISOString(),
        },
      ],
      entries: [
        ...current.entries,
        {
          id: createId(),
          noteId: createId(),
          type: "kasbon_bayar" as const,
          amount,
          method: "tunai" as const,
          item: null,
          qty: null,
          counterparty: person,
          confidence: 1,
          sourceText: `${person} bayar kasbon`,
          needsConfirmation: false,
          question: null,
          parser: "rule" as const,
          status: "confirmed" as const,
        },
      ],
    }));
    setPayOpen(false);
    setPayName("");
    setPayAmount("");
    setNotice("Pembayaran kasbon dicatat.");
  }

  const draftText = nav.draft || day.draftNote || "";
  const flow: Step | null =
    nav.step &&
    (nav.step === "hitung" || nav.step === "hasil" || nav.step === "export") &&
    !canCountDrawer(day.entries)
      ? closeGate(day.entries)
      : nav.step;
  const progress = flow ? progressOf(flow) : null;

  const footer = flow ? (
    <FlowFooter>
      {flow === "catat" && (
        <Button
          type="button"
          className="h-12 w-full lg:w-auto lg:min-w-56"
          data-testid="primary-cta"
          disabled={!draftText.trim() || reading}
          onClick={() => sendDraft(draftText.trim())}
        >
          Kirim — ekstrak catatan
        </Button>
      )}
      {flow === "loading" && (
        <Button type="button" className="h-12 w-full lg:w-auto lg:min-w-56" data-testid="primary-cta" disabled>
          Kirim — ekstrak catatan
        </Button>
      )}
      {flow === "fallback" && (
        <Button
          type="button"
          className="h-12 w-full lg:w-auto lg:min-w-56"
          data-testid="primary-cta"
          disabled={parseMoneyInput(manualAmount) == null}
          onClick={saveManual}
        >
          Simpan manual
        </Button>
      )}
      {(flow === "ambigu" || flow === "konfirmasi") && (
        <div>
          {reviewBlockMessage(day.entries) && (
            <p className="mb-2 text-sm text-[var(--short)]">{reviewBlockMessage(day.entries)}</p>
          )}
          <Button
            type="button"
            className="h-12 w-full lg:w-auto lg:min-w-56"
            data-testid="primary-cta"
            disabled={!canCountDrawer(day.entries)}
            onClick={() => goStep("hitung")}
          >
            Lanjut hitung laci
          </Button>
        </div>
      )}
      {flow === "hitung" && (
        <Button
          type="button"
          className="h-12 w-full lg:w-auto lg:min-w-56"
          data-testid="primary-cta"
          disabled={day.countedCash == null || !canCountDrawer(day.entries)}
          onClick={() => goStep("hasil")}
        >
          Lihat hasil
        </Button>
      )}
      {flow === "hasil" && (
        <div className="grid gap-2 lg:flex">
          <Button type="button" className="h-12 w-full lg:w-auto lg:min-w-56" data-testid="primary-cta" onClick={() => goStep("export")}>
            Bagikan rekap
          </Button>
          <Button type="button" variant="outline" className="h-12 w-full lg:w-auto" onClick={finishClose}>
            Selesai — ke Hari Ini
          </Button>
        </div>
      )}
      {flow === "export" && (
        <div className="grid gap-2 lg:flex lg:items-center">
          <Button type="button" className="h-12 w-full lg:w-auto lg:min-w-56" data-testid="primary-cta" onClick={copyRecap}>
            Salin teks WhatsApp
          </Button>
          <Button type="button" variant="outline" className="h-12 w-full lg:w-auto" onClick={finishClose}>
            Selesai — ke Hari Ini
          </Button>
          <Button type="button" variant="ghost" className="h-12 w-full lg:w-auto" onClick={downloadCsv}>
            Unduh CSV
          </Button>
        </div>
      )}
    </FlowFooter>
  ) : null;

  return (
    <>
      <AppShell
        warungName={day.warungName}
        dest={nav.dest}
        flowTitle={progress?.title}
        flowMeta={progress?.meta}
        inFlow={Boolean(flow)}
        showNav={showNav}
        demoLabel={day.isDemo ? `Data demo · ${day.warungName}, ${day.place}` : null}
        offline={offline}
        readNotice={readNotice}
        saveFailed={saveFailed}
        notice={notice}
        onBack={onBack}
        onDest={goDest}
        onSettings={() => setSettingsOpen(true)}
        footer={footer}
      >
        <div data-screen={flow ?? nav.dest}>
          {flow === "catat" && <CatatPane draft={draftText} onDraft={setDraft} />}
          {flow === "loading" && <LoadingPane />}
          {flow === "fallback" && (
            <FallbackPane amount={manualAmount} method={manualMethod} onAmount={setManualAmount} onMethod={setManualMethod} />
          )}
          {(flow === "ambigu" || flow === "konfirmasi") && (
            <KonfirmasiPane
              day={day}
              expected={result.expectedCash}
              omzet={result.penjualanTunai}
              masuk={tunaiMasuk}
              keluar={tunaiKeluar}
              onConfirm={confirmEntry}
              onChoose={chooseMethod}
              onUpdate={updateDraft}
              onDelete={deleteDraft}
              blockFor={(entry) => draftConfirmBlock(entry, [record, ...store.history.filter((item) => item.id !== record.id)])}
            />
          )}
          {flow === "hitung" && <HitungPane counted={day.countedCash} onCounted={(value) => saveCount(value)} />}
          {flow === "hasil" && <HasilPane day={day} result={result} masuk={tunaiMasuk} keluar={tunaiKeluar} />}
          {flow === "export" && <ExportPane text={toWhatsApp(day)} />}
          {!flow && nav.dest === "hari" && (
            <HomePane
              day={day}
              expected={result.expectedCash}
              omzet={result.penjualanTunai}
              masuk={tunaiMasuk}
              kasbonBayar={result.kasbonBayarTunai}
              unclear={unclear}
              pending={pendingCount}
              kasbonTotal={kasbonTotal}
              people={activePeople.length}
              closeLabel={gate === "hitung" ? "Tutup hari" : "Cek catatan"}
              closeDisabled={day.entries.length === 0}
              onClose={() => goStep(gate)}
              onCatat={() => goStep("catat")}
            />
          )}
          {!flow && nav.dest === "kasbon" && (
            <KasbonPane
              people={activePeople}
              total={kasbonTotal}
              demo={day.isDemo}
              payOpen={payOpen}
              payName={payName}
              payAmount={payAmount}
              payError={payError}
              onToggle={() => {
                setPayOpen((open) => {
                  if (!open) payLock.current = false;
                  return !open;
                });
                setPayError(null);
              }}
              onName={(value) => {
                setPayName(value);
                setPayError(null);
              }}
              onAmount={(value) => {
                setPayAmount(value);
                setPayError(null);
              }}
              onSave={saveKasbonPayment}
            />
          )}
          {!flow && nav.dest === "riwayat" && (
            <RiwayatPane
              active={day}
              history={store.history}
              onOpen={(next) => {
                commit((current) => ({
                  version: 1,
                  active: next,
                  history: [current.active, ...current.history]
                    .filter((item): item is DayRecord => !!item && item.id !== next.id)
                    .slice(0, 90),
                }));
                navigate({ dest: "hari", step: null, draft: next.draftNote ?? "" }, "push");
              }}
              onCheck={() => goStep(closeGate(day.entries))}
            />
          )}
          {flow && (
            <p className="mt-6 hidden text-sm lg:block">
              <button
                type="button"
                className="min-h-12 font-medium text-primary"
                onClick={() => navigate(reduceNav(navRef.current, { type: "home" }))}
              >
                Batalkan ke Hari Ini
              </button>
            </p>
          )}
          {flow && (
            <DayContext
              expected={result.expectedCash}
              pending={pendingCount}
              omzet={result.penjualanTunai}
              masuk={tunaiMasuk}
              counted={day.countedCash}
              qrisCounted={day.countedQris}
              qrisNoted={result.penjualanQris}
              kasbonTotal={kasbonTotal}
              people={activePeople.length}
              unclearLabel={unclear[0] ? unclearChip(unclear[0]) : null}
            />
          )}
        </div>
      </AppShell>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pengaturan</DialogTitle>
            <DialogDescription>Hari yang sedang terbuka dan data di HP ini.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSettingsOpen(false);
                setConfirmNew(true);
              }}
            >
              Hari baru
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSettingsOpen(false);
                setConfirmWipe(true);
              }}
            >
              Hapus data di HP ini
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mulai hari baru?</DialogTitle>
            <DialogDescription>Hari yang sedang terbuka pindah ke riwayat.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmNew(false)}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => {
                commit((current) => ({
                  version: 1,
                  active: null,
                  history: current.active
                    ? [current.active, ...current.history.filter((item) => item.id !== current.active?.id)].slice(0, 90)
                    : current.history,
                }));
                setConfirmNew(false);
                navigate({ dest: "hari", step: null, draft: "" }, "replace");
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
            <DialogTitle>Hapus semua data di HP ini?</DialogTitle>
            <DialogDescription>Catatan, tutup hari, dan kasbon di browser ini akan hilang.</DialogDescription>
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
                navigate({ dest: "hari", step: null, draft: "" }, "replace");
              }}
            >
              Hapus semua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

let networkOffline = false;
const networkListeners = new Set<() => void>();

function publishOffline(value: boolean) {
  if (networkOffline === value) return;
  networkOffline = value;
  for (const listener of networkListeners) listener();
}

function refreshNetwork() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    publishOffline(true);
    return;
  }
  fetch("/api/ping", { method: "GET", cache: "no-store" }).then(
    () => publishOffline(false),
    () => publishOffline(true),
  );
}

function subscribeOnline(onStoreChange: () => void) {
  networkListeners.add(onStoreChange);
  return () => networkListeners.delete(onStoreChange);
}

function onlineSnapshot() {
  return !networkOffline;
}

function serverOnline() {
  return true;
}
