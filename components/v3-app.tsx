"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  Banknote,
  BookOpen,
  Clock,
  Home,
  QrCode,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { closeDay, cashSign } from "@/lib/calculator";
import { extractNote } from "@/lib/client-api";
import { createDay } from "@/lib/day";
import { formatMediumDate } from "@/lib/dates";
import { createDemoDay, createDemoHistory } from "@/lib/demo";
import { explainClose } from "@/lib/explain";
import { toCsv, toWhatsApp } from "@/lib/export";
import {
  backTarget,
  canCountDrawer,
  closeGate,
  progressOf,
  reduceNav,
  showsBottomNav,
  type Dest,
  type NavState,
  type Step,
} from "@/lib/flow";
import { createId } from "@/lib/id";
import { kasbonBook } from "@/lib/kasbon";
import { formatRupiah, parseMoneyInput } from "@/lib/rupiah";
import { emptyStore } from "@/lib/storage";
import { METHOD_LABEL, TYPE_LABEL, type DayRecord, type Entry, type Store } from "@/lib/types";
import { useBook } from "@/lib/use-book";
import { cn } from "@/lib/utils";

const NAV_KEY = "tutuphari.nav.v3";

const DESTINATIONS: { id: Dest; label: string; icon: typeof Home }[] = [
  { id: "hari", label: "Hari Ini", icon: Home },
  { id: "kasbon", label: "Kasbon", icon: BookOpen },
  { id: "riwayat", label: "Riwayat", icon: Clock },
];

function compactRb(amount: number): string {
  const abs = Math.abs(amount);
  if (abs % 1000 === 0) return `${abs / 1000}rb`;
  return formatRupiah(abs);
}

function gapLabel(selisih: number | null): string {
  if (selisih == null) return "Belum dihitung";
  if (selisih === 0) return "Pas";
  return `${selisih < 0 ? "−" : "+"}${compactRb(selisih)}`;
}

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
  const [ambiguId, setAmbiguId] = useState<string | null>(null);
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
  const focusedAmbigu = ambiguId ? day.entries.find((entry) => entry.id === ambiguId) : undefined;
  const ambiguShown =
    focusedAmbigu && focusedAmbigu.method !== "tidak_tahu" ? focusedAmbigu : (unclear[0] ?? focusedAmbigu ?? null);
  const activePeople = book.filter((row) => row.outstanding > 0);
  const kasbonTotal = activePeople.reduce((sum, row) => sum + row.outstanding, 0);
  const showNav = showsBottomNav(nav.step);
  const gate = closeGate(day.entries);

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
    navigate(backTarget(navRef.current, unclear.length > 0), "replace");
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
    let landed: Step = "konfirmasi";
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
      landed = closeGate(entries) === "ambigu" ? "ambigu" : "konfirmasi";
      return { ...current, active };
    });
    navigate({ dest: navRef.current.dest, step: landed, draft: "" }, "replace");
  }

  function chooseMethod(id: string, method: "tunai" | "qris") {
    setAmbiguId(id);
    updateActive((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === id ? { ...entry, method, needsConfirmation: false, question: null } : entry,
      ),
    }));
  }

  function confirmEntry(id: string) {
    updateActive((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === id
          ? { ...entry, status: "confirmed", needsConfirmation: false, question: null }
          : entry,
      ),
    }));
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

  return (
    <div
      id="app-shell"
      className="bg-background text-foreground pt-[env(safe-area-inset-top)] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]"
      style={{ minHeight: "calc(100dvh - var(--kb))" }}
    >
      <aside className="sticky top-0 hidden h-[calc(100dvh-var(--kb))] flex-col border-r border-border bg-card px-3 py-4 lg:flex">
        <p className="px-3 pb-4 text-lg font-bold text-primary">TutupHari</p>
        <SidebarNav dest={nav.dest} onDest={goDest} />
      </aside>

      <div className="flex min-w-0 flex-col" style={{ minHeight: "calc(100dvh - var(--kb))" }}>
        {flow ? (
          <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
            <Button type="button" variant="outline" size="icon" aria-label="Kembali" onClick={onBack}>
              <ArrowLeft />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-tight">{progress?.title}</p>
              <p className="text-sm text-muted-foreground">{progress?.meta}</p>
            </div>
            <IconSettings onClick={() => setSettingsOpen(true)} />
          </header>
        ) : (
          <header className="flex items-center justify-between bg-background px-4 py-3">
            <p className="text-lg font-bold text-primary">TutupHari</p>
            <IconSettings onClick={() => setSettingsOpen(true)} />
          </header>
        )}

        {day.isDemo && <p className="bg-[#E5E5E5] px-4 py-2 text-xs font-medium tracking-wide text-[#404040]">Data demo · {day.warungName}, {day.place}</p>}
        {offline && (
          <p className="bg-card px-4 py-2 text-sm" data-testid="offline-banner">
            Kamu sedang offline. AI tidak tersedia. Catatan baru dibaca di HP ini, tanpa AI.
          </p>
        )}
        {readNotice && (
          <p className="px-4 py-2 text-sm" data-testid="read-label">
            {readNotice}
          </p>
        )}
        {saveFailed && (
          <p className="px-4 py-2 text-sm text-[#991B1B]">HP ini menolak penyimpanan. Catatan bisa hilang kalau halaman ditutup.</p>
        )}
        {notice && <p className="px-4 py-2 text-sm" aria-live="polite">{notice}</p>}

        <main className="mx-auto w-full max-w-3xl flex-1 overflow-x-hidden overflow-y-auto px-4 py-4" data-screen={flow ?? nav.dest}>
          {flow === "catat" && (
            <CatatPane draft={draftText} onDraft={setDraft} />
          )}
          {flow === "loading" && (
            <div className="grid min-h-48 place-items-center text-center">
              <div>
                <p className="text-lg font-bold">Membaca catatan…</p>
                <p className="mt-2 text-sm text-muted-foreground">Angka baru dihitung setelah kamu konfirmasi.</p>
              </div>
            </div>
          )}
          {flow === "fallback" && (
            <FallbackPane
              amount={manualAmount}
              method={manualMethod}
              onAmount={setManualAmount}
              onMethod={setManualMethod}
            />
          )}
          {flow === "ambigu" && (
            <AmbiguPane
              entry={ambiguShown}
              expected={result.expectedCash}
              onChoose={(method) => ambiguShown && chooseMethod(ambiguShown.id, method)}
            />
          )}
          {flow === "konfirmasi" && (
            <KonfirmasiPane
              day={day}
              expected={result.expectedCash}
              omzet={result.penjualanTunai}
              masuk={tunaiMasuk}
              keluar={tunaiKeluar}
              onConfirm={confirmEntry}
              onChoose={chooseMethod}
            />
          )}
          {flow === "hitung" && (
            <HitungPane counted={day.countedCash} onCounted={(value) => saveCount(value)} />
          )}
          {flow === "hasil" && (
            <HasilPane day={day} result={result} masuk={tunaiMasuk} keluar={tunaiKeluar} />
          )}
          {flow === "export" && <ExportPane text={toWhatsApp(day)} />}
          {!flow && nav.dest === "hari" && (
            <HomePane
              day={day}
              expected={result.expectedCash}
              omzet={result.penjualanTunai}
              masuk={tunaiMasuk}
              kasbonBayar={result.kasbonBayarTunai}
              unclear={unclear}
              kasbonTotal={kasbonTotal}
              people={activePeople.length}
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
              onToggle={() => setPayOpen((open) => !open)}
              onName={setPayName}
              onAmount={setPayAmount}
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
                  history: [current.active, ...current.history].filter((item): item is DayRecord => !!item && item.id !== next.id).slice(0, 90),
                }));
                navigate({ dest: "hari", step: null, draft: next.draftNote ?? "" }, "push");
              }}
            />
          )}
          {flow && (
            <p className="mt-6 hidden text-sm lg:block">
              <button type="button" className="min-h-12 font-medium text-primary" onClick={() => navigate(reduceNav(navRef.current, { type: "home" }))}>
                Batalkan ke Hari Ini
              </button>
            </p>
          )}
        </main>

        {(flow || nav.dest !== "riwayat") && (
        <footer className="sticky bottom-0 z-20 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-3xl">
          {flow === "catat" && (
            <Button type="button" className="w-full" data-testid="primary-cta" disabled={!draftText.trim() || reading} onClick={() => sendDraft(draftText.trim())}>
              Kirim — ekstrak catatan
            </Button>
          )}
          {flow === "loading" && (
            <Button type="button" className="w-full" data-testid="primary-cta" disabled>
              Kirim — ekstrak catatan
            </Button>
          )}
          {flow === "fallback" && (
            <Button type="button" className="w-full" data-testid="primary-cta" disabled={parseMoneyInput(manualAmount) == null} onClick={saveManual}>
              Simpan manual
            </Button>
          )}
          {flow === "ambigu" && (
            <Button
              type="button"
              className="w-full"
              data-testid="primary-cta"
              disabled={!ambiguShown || ambiguShown.method === "tidak_tahu"}
              onClick={() => {
                const rest = day.entries.filter((entry) => entry.method === "tidak_tahu");
                if (rest[0]) {
                  setAmbiguId(rest[0].id);
                  goStep("ambigu");
                } else {
                  setAmbiguId(null);
                  goStep("konfirmasi");
                }
              }}
            >
              Lanjut cek catatan
            </Button>
          )}
          {flow === "konfirmasi" && (
            <div>
              {gate !== "hitung" && (
                <p className="mb-2 text-sm text-[#991B1B]">
                  {gate === "ambigu"
                    ? "Masih ada catatan yang cara bayarnya belum dipilih."
                    : "Masih ada catatan yang belum dikonfirmasi."}
                </p>
              )}
              <Button type="button" className="w-full" data-testid="primary-cta" disabled={!canCountDrawer(day.entries)} onClick={() => goStep("hitung")}>
                Lanjut hitung laci
              </Button>
            </div>
          )}
          {flow === "hitung" && (
            <Button
              type="button"
              className="w-full"
              data-testid="primary-cta"
              disabled={day.countedCash == null || !canCountDrawer(day.entries)}
              onClick={() => goStep("hasil")}
            >
              Lihat hasil
            </Button>
          )}
          {flow === "hasil" && (
            <div className="grid gap-2">
              <Button type="button" className="w-full" data-testid="primary-cta" onClick={() => goStep("export")}>
                Bagikan rekap
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={finishClose}>
                Selesai — ke Hari Ini
              </Button>
            </div>
          )}
          {flow === "export" && (
            <div className="grid gap-2">
              <Button type="button" className="w-full" data-testid="primary-cta" onClick={copyRecap}>
                Salin teks WhatsApp
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={downloadCsv}>
                Unduh CSV
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={finishClose}>
                Selesai — ke Hari Ini
              </Button>
            </div>
          )}
          {!flow && nav.dest === "hari" && (
            <div className="grid gap-2">
              <Button type="button" className="w-full" data-testid="primary-cta" disabled={day.entries.length === 0} onClick={() => goStep(gate)}>
                Tutup hari
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => goStep("catat")}>
                Lanjutkan catat
              </Button>
            </div>
          )}
          {!flow && nav.dest === "kasbon" && !payOpen && (
            <Button type="button" className="w-full" data-testid="primary-cta" onClick={() => setPayOpen(true)}>
              Catat bayar kasbon
            </Button>
          )}
          {!flow && nav.dest === "kasbon" && payOpen && (
            <Button type="button" className="w-full" data-testid="primary-cta" disabled={!payName.trim() || parseMoneyInput(payAmount) == null} onClick={saveKasbonPayment}>
              Simpan pembayaran
            </Button>
          )}
          </div>
        </footer>
        )}

        {showNav && (
          <nav className="grid grid-cols-3 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Bagian utama">
            {DESTINATIONS.map((item) => (
              <NavButton key={item.id} current={nav.dest === item.id} label={item.label} icon={item.icon} onClick={() => goDest(item.id)} />
            ))}
          </nav>
        )}
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pengaturan</DialogTitle>
            <DialogDescription>Hari yang sedang terbuka dan data di HP ini.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button type="button" variant="outline" onClick={() => { setSettingsOpen(false); setConfirmNew(true); }}>
              Hari baru
            </Button>
            <Button type="button" variant="outline" onClick={() => { setSettingsOpen(false); setConfirmWipe(true); }}>
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
            <Button type="button" variant="outline" onClick={() => setConfirmNew(false)}>Batal</Button>
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
            <Button type="button" variant="outline" onClick={() => setConfirmWipe(false)}>Batal</Button>
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
    </div>
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

function IconSettings({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="icon" aria-label="Pengaturan" onClick={onClick}>
      <Settings />
    </Button>
  );
}

function NavButton({
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
        "flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs",
        current ? "border-t-2 border-primary font-bold text-foreground" : "border-t-2 border-transparent font-medium text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="size-5" strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}

function SidebarNav({ dest, onDest }: { dest: Dest; onDest: (dest: Dest) => void }) {
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
              "flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-base",
              current ? "border-l-2 border-primary font-bold text-foreground" : "border-l-2 border-transparent font-medium text-muted-foreground",
            )}
          >
            <Icon aria-hidden className="size-5" strokeWidth={2} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function StartScreen({
  onStart,
  onDemo,
}: {
  onStart: (name: string, modal: number) => void;
  onDemo: () => void;
}) {
  const [name, setName] = useState("");
  const [modal, setModal] = useState("");
  const amount = parseMoneyInput(modal);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <p className="text-lg font-bold text-primary">TutupHari</p>
      <h1 className="text-3xl font-bold tracking-tight">Catat kayak kirim pesan.</h1>
      <p className="text-muted-foreground">Pas warung tutup, lihat uang laci seharusnya dan selisih yang perlu dicek.</p>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (amount == null) return;
          onStart(name, amount);
        }}
      >
        <div>
          <Label htmlFor="warung">Nama warung</Label>
          <Input id="warung" className="mt-2 h-12" value={name} placeholder="Warung saya" onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="modal">Uang di laci sekarang</Label>
          <Input id="modal" inputMode="numeric" className="mt-2 h-12" value={modal} placeholder="200000" onChange={(event) => setModal(event.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={amount == null}>Mulai catat</Button>
      </form>
      <Button type="button" variant="outline" className="w-full" data-testid="start-demo" onClick={onDemo}>
        Coba demo
      </Button>
    </main>
  );
}

function CatatPane({ draft, onDraft }: { draft: string; onDraft: (text: string) => void }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Catat</h1>
      <Label htmlFor="draft-note" className="mt-4 block">Catat seperti chat</Label>
      <Textarea
        id="draft-note"
        value={draft}
        onChange={(event) => onDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.scrollIntoView({ block: "center" })}
        placeholder="jual es teh 2 10rb"
        className="mt-2 min-h-32 text-base"
      />
    </div>
  );
}

function FallbackPane({
  amount,
  method,
  onAmount,
  onMethod,
}: {
  amount: string;
  method: "tunai" | "qris";
  onAmount: (value: string) => void;
  onMethod: (method: "tunai" | "qris") => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Isi manual</h1>
      <p className="mt-3 rounded-lg border border-[#991B1B] bg-[#FEF2F2] px-3 py-3 text-sm text-[#991B1B]">
        AI tidak merespons. Isi jumlah dan cara bayar sendiri.
      </p>
      <Label htmlFor="manual-amount" className="mt-4 block">Jumlah (rupiah)</Label>
      <Input id="manual-amount" inputMode="numeric" className="mt-2 h-14 text-2xl" value={amount} onChange={(event) => onAmount(event.target.value)} />
      <MethodChoice method={method} onMethod={onMethod} />
    </div>
  );
}

function AmbiguPane({
  entry,
  expected,
  onChoose,
}: {
  entry: Entry | null;
  expected: number;
  onChoose: (method: "tunai" | "qris") => void;
}) {
  if (!entry || entry.amount == null) {
    return <p>Tidak ada catatan yang perlu dipilih.</p>;
  }
  const chosen = entry.method === "tunai" || entry.method === "qris" ? entry.method : null;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Perlu kamu pilih</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Cara bayar belum jelas. Saat ini belum masuk uang laci seharusnya {formatRupiah(expected)}. Tunai → {formatRupiah(expected + entry.amount)}. QRIS → tetap {formatRupiah(expected)}, QRIS +{formatRupiah(entry.amount)}.
      </p>
      <div className="mt-4 rounded-xl border border-[#991B1B] bg-card p-4">
        <p className="inline-flex min-h-8 items-center rounded-full border border-[#991B1B] px-2 text-xs font-medium text-[#991B1B]">
          {chosen ? METHOD_LABEL[chosen] : "Belum dipilih"}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Dari catatan</p>
        <p className="font-medium">“{entry.sourceText}”</p>
        <p className="money mt-2 text-3xl font-bold">{formatRupiah(entry.amount)}</p>
        <MethodChoice method={chosen} onMethod={onChoose} />
      </div>
    </div>
  );
}

function MethodChoice({
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
          "min-h-16 rounded-lg border bg-card px-3 py-2 text-sm font-bold text-[#14532D]",
          method === "tunai" ? "border-[#14532D] ring-1 ring-[#14532D]" : "border-[#166534]",
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
          "min-h-16 rounded-lg border bg-card px-3 py-2 text-sm font-bold text-[#1E3A8A]",
          method === "qris" ? "border-[#1E3A8A] ring-1 ring-[#1E3A8A]" : "border-[#1E3A8A]",
        )}
      >
        <QrCode className="mx-auto mb-1 size-4" aria-hidden />
        QRIS
        <span className="mt-1 block text-xs font-medium">bukan laci</span>
      </button>
    </div>
  );
}

function KonfirmasiPane({
  day,
  expected,
  omzet,
  masuk,
  keluar,
  onConfirm,
  onChoose,
}: {
  day: DayRecord;
  expected: number;
  omzet: number;
  masuk: number;
  keluar: number;
  onConfirm: (id: string) => void;
  onChoose: (id: string, method: "tunai" | "qris") => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Cek sebelum tutup</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Uang laci seharusnya {formatRupiah(expected)} (modal {compactRb(day.modalAwal)} + tunai masuk {compactRb(masuk)} − keluar {compactRb(keluar)}). Omzet tunai {formatRupiah(omzet)}, bukan total tunai masuk.
      </p>
      <ul className="mt-4 grid gap-2">
        {[...day.entries].sort((a, b) => Number(b.status !== "confirmed") - Number(a.status !== "confirmed")).map((entry) => {
          const sign = cashSign(entry.type);
          const negative = entry.method === "tunai" && sign != null && sign < 0;
          const open = entry.status !== "confirmed" || entry.needsConfirmation || entry.method === "tidak_tahu";
          return (
            <li key={entry.id} className={cn("rounded-xl border bg-card p-3", open ? "border-[#991B1B]" : "border-border")}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {entry.method === "tidak_tahu" ? "Belum dipilih" : `${METHOD_LABEL[entry.method]} · ${TYPE_LABEL[entry.type]}`}
                </span>
                {entry.status === "confirmed" && <span className="text-xs text-[#166534]">Sudah dikonfirmasi</span>}
              </div>
              <p className="money mt-1 text-2xl font-bold">{negative ? `−${formatRupiah(entry.amount ?? 0)}` : formatRupiah(entry.amount ?? 0)}</p>
              <p className="text-sm text-muted-foreground">“{entry.sourceText}”</p>
              {entry.method === "tidak_tahu" && (
                <MethodChoice method={null} onMethod={(method) => onChoose(entry.id, method)} />
              )}
              {entry.status !== "confirmed" && entry.method !== "tidak_tahu" && (
                <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => onConfirm(entry.id)}>
                  Konfirmasi catatan ini
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HitungPane({ counted, onCounted }: { counted: number | null; onCounted: (raw: string) => void }) {
  const [text, setText] = useState(counted == null ? "" : String(counted));
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Hitung laci</h1>
      <p className="mt-2 text-sm text-muted-foreground">Hitung uang kertas dan koin yang ada di laci. QRIS tidak dijumlah ke sini.</p>
      <Label htmlFor="counted-cash" className="mt-4 block">Uang yang dihitung di laci</Label>
      <Input
        id="counted-cash"
        inputMode="numeric"
        className="money mt-2 h-14 text-2xl"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onCounted(event.target.value);
        }}
        onFocus={(event) => event.currentTarget.scrollIntoView({ block: "center" })}
      />
    </div>
  );
}

function HasilPane({
  day,
  result,
  masuk,
  keluar,
}: {
  day: DayRecord;
  result: ReturnType<typeof closeDay>;
  masuk: number;
  keluar: number;
}) {
  const tone = result.verdict === "kurang" ? "text-[#991B1B]" : result.verdict === "pas" ? "text-[#166534]" : "text-foreground";
  const title =
    result.selisih == null
      ? "Belum dihitung"
      : result.selisih === 0
        ? "Pas Rp0"
        : result.selisih < 0
          ? `Kurang −${formatRupiah(Math.abs(result.selisih))}`
          : `Lebih +${formatRupiah(result.selisih)}`;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Hasil tutup hari</h1>
      <p className="mt-1 text-sm text-muted-foreground">Dihitung di perangkat</p>
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Uang laci seharusnya</p>
        <p className="money text-4xl font-bold">{formatRupiah(result.expectedCash)}</p>
        <p className={cn("mt-2 text-lg font-bold", tone)}>{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hitung laci aktual {result.countedCash == null ? "belum diisi" : formatRupiah(result.countedCash)}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Omzet tunai {formatRupiah(result.penjualanTunai)} · Total tunai masuk {formatRupiah(masuk)} · Keluar {formatRupiah(keluar)}
          {result.penjualanQris > 0 ? ` · QRIS ${formatRupiah(result.penjualanQris)} (bukan laci)` : ""}
        </p>
      </div>
      <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">{explainClose(result)}</p>
      <p className="mt-3 text-xs text-muted-foreground">{day.warungName}. Bukan laporan keuangan atau pajak.</p>
    </div>
  );
}

function ExportPane({ text }: { text: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Bagikan rekap</h1>
      <pre className="mt-4 overflow-x-hidden rounded-xl border border-border bg-card p-4 text-sm leading-relaxed whitespace-pre-wrap">{text}</pre>
    </div>
  );
}

function HomePane({
  day,
  expected,
  omzet,
  masuk,
  kasbonBayar,
  unclear,
  kasbonTotal,
  people,
}: {
  day: DayRecord;
  expected: number;
  omzet: number;
  masuk: number;
  kasbonBayar: number;
  unclear: Entry[];
  kasbonTotal: number;
  people: number;
}) {
  const first = unclear[0];
  return (
    <div>
      <p className="text-sm text-muted-foreground">{formatMediumDate(day.date)}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Hari ini</h1>
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Uang laci seharusnya</p>
        <p className="money text-4xl font-bold" data-testid="home-expected">{formatRupiah(expected)}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Dari catatan yang sudah dikonfirmasi
          {first && first.amount != null
            ? ` · belum termasuk ${unclear.length} item perlu dipilih (${first.item ?? "catatan"} ${compactRb(first.amount)})`
            : ""}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Omzet tunai</p>
          <p className="money text-xl font-bold">{formatRupiah(omzet)}</p>
          <p className="text-xs text-muted-foreground">penjualan saja</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total tunai masuk</p>
          <p className="money text-xl font-bold">{formatRupiah(masuk)}</p>
          <p className="text-xs break-words text-muted-foreground">{compactRb(omzet)} omzet + {compactRb(kasbonBayar)} bayar kasbon</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Kasbon aktif {formatRupiah(kasbonTotal)} · {people} orang
      </p>
    </div>
  );
}

function KasbonPane({
  people,
  total,
  demo,
  payOpen,
  payName,
  payAmount,
  onToggle,
  onName,
  onAmount,
}: {
  people: { person: string; outstanding: number; movements: { source: string; direction: string; amount: number }[] }[];
  total: number;
  demo: boolean;
  payOpen: boolean;
  payName: string;
  payAmount: string;
  onToggle: () => void;
  onName: (value: string) => void;
  onAmount: (value: string) => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Buku kasbon</h1>
      <p className="mt-1 text-sm text-muted-foreground">Saldo lintas hari{demo ? " · Data demo" : ""}</p>
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Total belum lunas</p>
        <p className="money text-4xl font-bold text-[#5B21B6]">{formatRupiah(total)}</p>
      </div>
      {people.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Belum ada kasbon yang belum lunas.</p>}
      <ul className="mt-3 grid gap-2">
        {people.map((row) => (
          <li key={row.person} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">{row.person}</p>
              <p className="money font-bold">{formatRupiah(row.outstanding)}</p>
            </div>
            <p className="text-sm text-muted-foreground">{kasbonHint(row)}</p>
          </li>
        ))}
      </ul>
      {payOpen && (
        <div className="mt-4 grid gap-3">
          <div>
            <Label htmlFor="pay-name">Nama</Label>
            <Input id="pay-name" className="mt-2 h-12" value={payName} onChange={(event) => onName(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="pay-amount">Jumlah yang dibayar</Label>
            <Input id="pay-amount" inputMode="numeric" className="mt-2 h-12" value={payAmount} onChange={(event) => onAmount(event.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={onToggle}>Batal</Button>
        </div>
      )}
    </div>
  );
}

function kasbonHint(row: { outstanding: number; movements: { source: string; direction: string; amount: number }[] }): string {
  const paid = [...row.movements].reverse().find((move) => move.direction === "bayar");
  if (paid && row.outstanding > 0) return `Sisa setelah bayar ${formatRupiah(paid.amount)}`;
  return [...row.movements].reverse().find((move) => move.direction !== "awal")?.source ?? row.movements.at(-1)?.source ?? "";
}

function RiwayatPane({
  active,
  history,
  onOpen,
}: {
  active: DayRecord;
  history: DayRecord[];
  onOpen: (day: DayRecord) => void;
}) {
  const rows = [active, ...history.filter((day) => day.id !== active.id)];
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Riwayat</h1>
      <p className="mt-1 text-sm text-muted-foreground">Hari-hari sebelumnya</p>
      <ul className="mt-4 grid gap-2">
        {rows.map((day) => {
          const result = closeDay({
            modalAwal: day.modalAwal,
            entries: day.entries,
            countedCash: day.countedCash,
            countedQris: day.countedQris,
          });
          const tone = result.verdict === "kurang" ? "text-[#991B1B]" : result.verdict === "pas" ? "text-[#166534]" : "text-foreground";
          return (
            <li key={day.id}>
              <button type="button" className="min-h-16 w-full rounded-xl border border-border bg-card p-3 text-left" onClick={() => onOpen(day)}>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-bold">{formatMediumDate(day.date)}</span>
                  <span className={cn("font-bold", tone)}>{gapLabel(result.selisih)}</span>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Laci seharusnya {compactRb(result.expectedCash)}
                  {day.closedAt ? "" : " · berjalan"}
                  {day.isDemo ? " · Data demo" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
