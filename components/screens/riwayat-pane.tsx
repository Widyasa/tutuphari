"use client";

import { Button } from "@/components/ui/button";
import { compactRb, gapLabel, toneClass } from "@/components/ui-tokens";
import { closeDay } from "@/lib/calculator";
import { formatMediumDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DayRecord } from "@/lib/types";

export function RiwayatPane({
  active,
  history,
  onOpen,
  onCheck,
}: {
  active: DayRecord;
  history: DayRecord[];
  onOpen: (day: DayRecord) => void;
  onCheck: () => void;
}) {
  const rows = [active, ...history.filter((day) => day.id !== active.id)];
  return (
    <div className="rise">
      <h1 className="text-[1.5rem] font-bold tracking-[-0.035em] md:text-3xl">Riwayat</h1>
      <p className="mt-1 text-sm text-muted-foreground">Hari-hari sebelumnya</p>
      <ul className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((day) => {
          const result = closeDay({
            modalAwal: day.modalAwal,
            entries: day.entries,
            countedCash: day.countedCash,
            countedQris: day.countedQris,
          });
          const pending = day.entries.some(
            (entry) => entry.status !== "confirmed" || entry.needsConfirmation || entry.method === "tidak_tahu",
          );
          const provisional = !day.closedAt && pending;
          return (
            <li key={day.id} className="surface p-3.5 transition-shadow hover:shadow-[var(--surface-shadow-lg)]">
              <button type="button" className="min-h-12 w-full text-left" onClick={() => onOpen(day)}>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-bold">{formatMediumDate(day.date)}</span>
                  <span className={cn("font-bold", provisional ? "text-[var(--short)]" : toneClass(result.verdict))}>
                    {provisional ? "Belum final" : gapLabel(result.selisih)}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {provisional
                    ? `Selisih sementara ${gapLabel(result.selisih)} · catatan belum selesai`
                    : `Laci seharusnya ${compactRb(result.expectedCash)}`}
                  {day.closedAt ? "" : provisional ? "" : " · berjalan"}
                  {day.isDemo ? " · Data demo" : ""}
                </span>
              </button>
              {provisional && day.id === active.id && (
                <Button type="button" className="mt-3 h-12 w-full" onClick={onCheck}>
                  Cek catatan
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
