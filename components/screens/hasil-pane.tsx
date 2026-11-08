"use client";

import { useEffect, useState } from "react";
import { toneClass } from "@/components/ui-tokens";
import { closeDay } from "@/lib/calculator";
import { explainDay } from "@/lib/client-api";
import { CASH_DISCLAIMER } from "@/lib/copy";
import { closingSentenceView, explainClose, explanationSignature, shareInflight } from "@/lib/explain";
import { formatRupiah } from "@/lib/rupiah";
import { cn } from "@/lib/utils";
import type { DayRecord } from "@/lib/types";

const explainInflight = new Map<string, Promise<{ parser: "ai" | "rule"; explanation: string } | null>>();

export function HasilPane({
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
  const localText = explainClose(result);
  const signature = explanationSignature({
    modalAwal: day.modalAwal,
    countedCash: day.countedCash,
    countedQris: day.countedQris,
    warungName: day.warungName,
    expectedCash: result.expectedCash,
    selisih: result.selisih,
    entries: day.entries,
  });
  const [ai, setAi] = useState<{ signature: string; text: string | null } | null>(null);
  const settled = ai?.signature === signature ? ai : null;
  useEffect(() => {
    if (day.countedCash == null) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void shareInflight(explainInflight, signature, () =>
        explainDay({
          warungName: day.warungName,
          modalAwal: day.modalAwal,
          countedCash: day.countedCash,
          countedQris: day.countedQris,
          entries: day.entries,
        }),
      ).then((response) => {
        const fromAi = Boolean(response?.parser === "ai" && response.explanation.trim());
        if (!fromAi) explainInflight.delete(signature);
        if (cancelled) return;
        setAi({
          signature,
          text: fromAi ? response?.explanation ?? null : null,
        });
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [signature, day]);
  const view = closingSentenceView({
    status: day.countedCash == null ? "fallback" : settled ? (settled.text ? "ai" : "fallback") : "loading",
    aiText: settled?.text ?? null,
    localText,
  });
  const title =
    result.selisih == null
      ? "Belum dihitung"
      : result.selisih === 0
        ? "Pas Rp0"
        : result.selisih < 0
          ? `Kurang −${formatRupiah(Math.abs(result.selisih))}`
          : `Lebih +${formatRupiah(result.selisih)}`;
  return (
    <div className="rise">
      <h1 className="text-2xl font-bold tracking-[-0.03em] md:text-3xl">Hasil tutup hari</h1>
      <p className="mt-1 text-sm text-muted-foreground">Dihitung di perangkat</p>
      <div className="surface-hero mt-4 p-5">
        <p className="eyebrow">Uang laci seharusnya</p>
        <p className="money mt-1 text-4xl font-bold md:text-5xl">{formatRupiah(result.expectedCash)}</p>
        <p className={cn("mt-3 text-lg font-bold", toneClass(result.verdict))}>{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hitung laci aktual {result.countedCash == null ? "belum diisi" : formatRupiah(result.countedCash)}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Omzet tunai {formatRupiah(result.penjualanTunai)} · Total tunai masuk {formatRupiah(masuk)} · Keluar {formatRupiah(keluar)}
          {result.penjualanQris > 0 ? ` · QRIS ${formatRupiah(result.penjualanQris)} (bukan laci)` : ""}
        </p>
      </div>
      <div className="surface mt-4 p-4">
        <p className="text-sm font-semibold" data-testid="explain-label" data-from-ai={view.fromAi ? "true" : "false"}>
          {view.label}
        </p>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap" data-testid="explain-text">
          {view.text}
        </p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {day.warungName}. {CASH_DISCLAIMER}
      </p>
    </div>
  );
}
