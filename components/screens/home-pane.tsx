"use client";

import { Button } from "@/components/ui/button";
import { compactRb } from "@/components/ui-tokens";
import { CASH_DISCLAIMER } from "@/lib/copy";
import { formatMediumDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/rupiah";
import type { DayRecord, Entry } from "@/lib/types";

export function HomePane({
  day,
  expected,
  omzet,
  masuk,
  kasbonBayar,
  unclear,
  pending,
  kasbonTotal,
  people,
  closeLabel,
  closeDisabled,
  onClose,
  onCatat,
}: {
  day: DayRecord;
  expected: number;
  omzet: number;
  masuk: number;
  kasbonBayar: number;
  unclear: Entry[];
  pending: number;
  kasbonTotal: number;
  people: number;
  closeLabel: string;
  closeDisabled: boolean;
  onClose: () => void;
  onCatat: () => void;
}) {
  const first = unclear[0];
  return (
    <>
      <div className="rise lg:hidden">
        <p className="text-sm text-muted-foreground">{formatMediumDate(day.date)}</p>
        <h1 className="mt-1 text-[1.5rem] font-bold tracking-[-0.02em] md:text-[1.75rem]">Hari ini</h1>
        <div className="surface-hero mt-4 p-5 md:p-6">
          <p className="eyebrow">Uang laci seharusnya</p>
          {pending === 0 && <p className="ok-text mt-1 text-sm font-semibold">Siap dihitung</p>}
          <p className="money mt-2 text-4xl font-semibold md:text-5xl" data-testid="home-expected">
            {formatRupiah(expected)}
          </p>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            Dari catatan yang sudah dikonfirmasi
            {first && first.amount != null
              ? ` · belum termasuk ${unclear.length} item perlu dipilih (${first.item ?? "catatan"} ${compactRb(first.amount)})`
              : pending > 0
                ? ` · ${pending} catatan belum dikonfirmasi`
                : ""}
          </p>
          {pending > 0 && (
            <p className="alert-surface mt-3 text-sm font-semibold">
              Angka ini belum final. Masih ada catatan yang belum selesai.
            </p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="surface p-3.5">
            <p className="text-xs text-muted-foreground">Omzet tunai</p>
            <p className="money text-xl font-semibold">{formatRupiah(omzet)}</p>
            <p className="text-xs text-muted-foreground">penjualan saja</p>
          </div>
          <div className="surface p-3.5">
            <p className="text-xs text-muted-foreground">Total tunai masuk</p>
            <p className="money text-xl font-semibold">{formatRupiah(masuk)}</p>
            <p className="text-xs break-words text-muted-foreground">
              {compactRb(omzet)} omzet + {compactRb(kasbonBayar)} bayar kasbon
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Kasbon aktif <span className="money font-semibold text-[var(--kasbon)]">{formatRupiah(kasbonTotal)}</span> · {people}{" "}
          orang
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button type="button" className="h-12 w-full" data-testid="primary-cta" disabled={closeDisabled} onClick={onClose}>
            {closeLabel}
          </Button>
          <Button type="button" variant="outline" className="h-12 w-full bg-card/80" onClick={onCatat}>
            Lanjutkan catat
          </Button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{CASH_DISCLAIMER}</p>
      </div>
      <div className="rise hidden lg:block">
        <h1 className="text-[1.875rem] font-bold tracking-[-0.025em]">Hari ini</h1>
        <p className="text-sm text-muted-foreground">
          {day.entries.length} catatan
          {pending > 0 ? ` · ${pending} perlu diperiksa sebelum tutup hari.` : " · siap dihitung."}
        </p>
        {pending > 0 && (
          <div className="mt-4 flex items-center justify-between gap-4 border border-[var(--short)]/35 bg-card px-5 py-4 text-[var(--short)]">
            <p>
              <span className="font-bold">
                Perlu diperiksa: {first?.item ?? "catatan"} {first?.amount != null ? formatRupiah(first.amount) : ""}
              </span>
              <span className="mt-1 block">Tunai atau QRIS belum selesai. Perhitungan belum final.</span>
            </p>
            <Button type="button" className="h-12 shrink-0" disabled={closeDisabled} onClick={onClose}>
              {closeLabel === "Cek catatan" ? "Periksa catatan" : closeLabel}
            </Button>
          </div>
        )}
        <div className="desk-workspace mt-6">
          <section className="desk-paper">
            <p className="eyebrow">{pending > 0 ? "Uang laci seharusnya sementara" : "Uang laci seharusnya"}</p>
            <p className="money mt-1 text-[2.875rem] font-semibold">{formatRupiah(expected)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {first && first.amount != null
                ? `Belum termasuk ${first.item ?? "catatan"} ${formatRupiah(first.amount)} yang perlu dipilih.`
                : pending > 0
                  ? "Belum final. Masih ada catatan yang belum dikonfirmasi."
                  : "Dari catatan yang sudah dikonfirmasi."}
            </p>
            <div className="mt-3 divide-y divide-border border-y border-border">
              <p className="flex justify-between py-3 text-sm">
                <span>Omzet tunai</span>
                <span className="money font-semibold">{formatRupiah(omzet)}</span>
              </p>
              <p className="flex justify-between py-3 text-sm">
                <span>Total tunai masuk</span>
                <span className="money font-semibold">{formatRupiah(masuk)}</span>
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{CASH_DISCLAIMER}</p>
            <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5">
              <p className="text-[13px] text-muted-foreground">Catatan baru masih bisa ditambahkan.</p>
              <Button type="button" variant="ghost" className="h-12" onClick={onCatat}>
                Catat lagi
              </Button>
            </div>
            {pending === 0 && (
              <Button type="button" className="mt-4 h-12" disabled={closeDisabled} onClick={onClose}>
                {closeLabel}
              </Button>
            )}
          </section>
          <aside className="desk-context">
            <h2 className="text-xl font-bold tracking-tight">Tutup hari</h2>
            <p className="mt-1 text-sm text-muted-foreground">Periksa metode pembayaran, hitung uang fisik, lalu cocokkan laci.</p>
            <div className="mt-3 divide-y divide-border border-y border-border text-sm">
              <p className="flex justify-between gap-3 py-3">
                <span>Hitung laci yang tersimpan</span>
                <span className="money font-semibold">{day.countedCash == null ? "belum diisi" : formatRupiah(day.countedCash)}</span>
              </p>
              <p className="flex justify-between gap-3 py-3">
                <span>QRIS terhitung · bukan laci</span>
                <span className="money font-semibold">{formatRupiah(day.countedQris ?? 0)}</span>
              </p>
            </div>
            <h2 className="mt-5 text-xl font-bold tracking-tight">Kasbon</h2>
            <p>
              Total belum lunas <span className="money font-semibold text-[var(--kasbon)]">{formatRupiah(kasbonTotal)}</span>
            </p>
            <p className="text-[13px] text-muted-foreground">{people} orang belum lunas</p>
          </aside>
        </div>
      </div>
    </>
  );
}
