"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MoneyField } from "@/components/money-field";
import { Receipt } from "@/components/receipt";
import { closeDay } from "@/lib/calculator";
import { explainDay } from "@/lib/client-api";
import { explainClose } from "@/lib/explain";
import { toCsv, toWhatsApp } from "@/lib/export";
import type { DayRecord } from "@/lib/types";

const ADD = [20_000, 50_000, 100_000, 200_000];

export function TutupScreen({
  day,
  onCountedCash,
  onCountedQris,
  onClose,
  onNotice,
}: {
  day: DayRecord;
  onCountedCash: (value: number | null) => void;
  onCountedQris: (value: number | null) => void;
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const result = closeDay({
    modalAwal: day.modalAwal,
    entries: day.entries,
    countedCash: day.countedCash,
    countedQris: day.countedQris,
  });
  const localText = explainClose(result);
  const signature = JSON.stringify({
    modal: day.modalAwal,
    cash: day.countedCash,
    qris: day.countedQris,
    name: day.warungName,
    entries: day.entries.map((entry) => [
      entry.id,
      entry.status,
      entry.type,
      entry.method,
      entry.amount,
      entry.needsConfirmation,
      entry.sourceText,
    ]),
  });
  const [ai, setAi] = useState<{ signature: string; text: string | null } | null>(null);
  const settled = ai?.signature === signature ? ai : null;

  useEffect(() => {
    if (day.countedCash == null) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void explainDay({
        warungName: day.warungName,
        modalAwal: day.modalAwal,
        countedCash: day.countedCash,
        countedQris: day.countedQris,
        entries: day.entries,
      }).then((response) => {
        if (cancelled) return;
        setAi({
          signature,
          text: response?.parser === "ai" ? response.explanation : null,
        });
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [signature, day]);

  const paragraph = settled?.text ?? localText;
  const label = settled?.text
    ? "Kalimat AI"
    : day.countedCash != null && !settled
      ? "Lagi minta kalimat AI"
      : "Ringkasan tanpa AI";

  async function copyMessage() {
    const message = toWhatsApp(day);
    try {
      await navigator.clipboard.writeText(message);
      onNotice("Teks WhatsApp tersalin.");
    } catch {
      onNotice("Gagal menyalin. Salin manual dari kotak di bawah.");
    }
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(day)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tutuphari-${day.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotice("CSV terunduh.");
  }

  return (
    <div className="grid gap-4">
      {day.isDemo && (
        <p className="rounded-xl bg-warn px-3 py-2 text-warn-ink">
          Angka laci contoh sudah diisi Rp240.000. Boleh diubah.
        </p>
      )}
      <MoneyField
        id="counted-cash"
        label="Uang yang kamu hitung di laci"
        value={day.countedCash}
        onChange={onCountedCash}
        large
      />
      <div className="grid grid-cols-4 gap-2">
        {ADD.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="outline"
            onClick={() => onCountedCash((day.countedCash ?? 0) + amount)}
          >
            +{amount / 1000}rb
          </Button>
        ))}
      </div>
      <Button type="button" variant="ghost" onClick={() => onCountedCash(null)}>
        Ulangi hitung
      </Button>

      <MoneyField
        id="counted-qris"
        label="Total QRIS di aplikasi (kalau ada)"
        value={day.countedQris}
        onChange={onCountedQris}
        hint="Kosongkan kalau tidak dicek. QRIS tidak masuk laci."
      />

      <Receipt day={day} />

      <section aria-live="polite">
        <h2 className="font-bold">{label}</h2>
        <p className="mt-1">{paragraph}</p>
      </section>

      <div className="grid gap-2">
        <Button type="button" onClick={() => void copyMessage()} disabled={day.countedCash == null}>
          Salin untuk WhatsApp
        </Button>
        <Button type="button" variant="outline" onClick={downloadCsv}>
          Unduh CSV
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          {day.closedAt ? "Perbarui simpanan" : "Simpan hari ini"}
        </Button>
      </div>
      <p className="text-sm">
        Alat bantu cek kas, bukan laporan keuangan atau pajak. AI bisa salah — selalu dicek sendiri.
      </p>
    </div>
  );
}
