"use client";

import { formatRupiah } from "@/lib/rupiah";

export function DayContext({
  expected,
  pending,
  omzet,
  masuk,
  counted,
  qrisCounted,
  qrisNoted,
  kasbonTotal,
  people,
  unclearLabel,
}: {
  expected: number;
  pending: number;
  omzet: number;
  masuk: number;
  counted: number | null;
  qrisCounted: number | null;
  qrisNoted: number;
  kasbonTotal: number;
  people: number;
  unclearLabel: string | null;
}) {
  return (
    <aside className="desk-context hidden lg:block">
      <h2 className="text-xl font-bold tracking-[-0.03em]">Ringkasan hari ini</h2>
      <p className="eyebrow mt-3">{pending > 0 ? "Uang laci seharusnya sementara" : "Uang laci seharusnya"}</p>
      <p className="money mt-1 text-[1.75rem] font-semibold">{formatRupiah(expected)}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Dari catatan yang sudah dikonfirmasi.
        {unclearLabel ? ` ${unclearLabel} belum termasuk.` : pending > 0 ? " Masih ada catatan belum dikonfirmasi." : ""}
      </p>
      <div className="mt-3 divide-y divide-border border-y border-border text-sm">
        <p className="flex justify-between gap-3 py-3">
          <span>Omzet tunai</span>
          <span className="money font-semibold">{formatRupiah(omzet)}</span>
        </p>
        <p className="flex justify-between gap-3 py-3">
          <span>Total tunai masuk</span>
          <span className="money font-semibold">{formatRupiah(masuk)}</span>
        </p>
        <p className="flex justify-between gap-3 py-3">
          <span>Hitung laci</span>
          <span className="money font-semibold">{counted == null ? "belum diisi" : formatRupiah(counted)}</span>
        </p>
        <p className="flex justify-between gap-3 py-3">
          <span>
            QRIS terhitung
            <span className="mt-0.5 block text-xs text-muted-foreground">Bukan uang laci</span>
          </span>
          <span className="money font-semibold">{formatRupiah(qrisCounted ?? qrisNoted)}</span>
        </p>
      </div>
      <h2 className="mt-5 text-xl font-bold tracking-tight">Kasbon</h2>
      <p>
        Total belum lunas <span className="money font-semibold text-[var(--kasbon)]">{formatRupiah(kasbonTotal)}</span>
      </p>
      <p className="text-[13px] text-muted-foreground">{people} orang</p>
      {pending > 0 && <p className="mt-4 text-[13px] text-muted-foreground">Angka sementara bukan hasil akhir.</p>}
    </aside>
  );
}
