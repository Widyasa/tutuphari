"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/components/receipt";
import { formatLongDate } from "@/lib/dates";
import { kasbonBook } from "@/lib/kasbon";
import { formatRupiah } from "@/lib/rupiah";
import { closeDay } from "@/lib/calculator";
import type { DayRecord } from "@/lib/types";
import { cn } from "cn";

export function RiwayatScreen({
  active,
  history,
  onOpen,
  onDelete,
  onDeleteAll,
}: {
  active: DayRecord | null;
  history: DayRecord[];
  onOpen: (day: DayRecord) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}) {
  const days = [
    ...(active ? [active] : []),
    ...history.filter((day) => day.id !== active?.id),
  ];
  const real = days.filter((day) => !day.isDemo);
  const demo = days.filter((day) => day.isDemo);
  const [scope, setScope] = useState<"real" | "demo">(active?.isDemo ? "demo" : "real");
  const [openId, setOpenId] = useState<string | null>(active?.id ?? null);
  const [armed, setArmed] = useState<string | null>(null);
  const visible = scope === "demo" ? demo : real;
  const book = kasbonBook(visible);

  return (
    <div className="grid gap-6">
      {(real.length > 0 && demo.length > 0) || active?.isDemo ? (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Jenis riwayat">
          <Button
            type="button"
            variant={scope === "real" ? "default" : "outline"}
            onClick={() => setScope("real")}
          >
            Usaha saya
          </Button>
          <Button
            type="button"
            variant={scope === "demo" ? "default" : "outline"}
            onClick={() => setScope("demo")}
          >
            Contoh
          </Button>
        </div>
      ) : null}

      <section>
        <h2 className="text-xl font-bold">Hari</h2>
        {visible.length === 0 ? (
          <p className="mt-2">Belum ada hari di sini. Tutup hari dulu, atau coba demo.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {visible.map((day) => {
              const result = closeDay({
                modalAwal: day.modalAwal,
                entries: day.entries,
                countedCash: day.countedCash,
                countedQris: day.countedQris,
              });
              const opened = openId === day.id;
              return (
                <li key={day.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="font-bold">
                    {day.warungName}
                    {day.isDemo ? " · contoh" : ""}
                  </p>
                  <p>{formatLongDate(day.date)}</p>
                  <p className="money mt-1 text-xl">
                    {result.selisih == null
                      ? "Belum ditutup"
                      : result.selisih === 0
                        ? "Pas"
                        : `${result.verdict === "kurang" ? "Kurang" : "Lebih"} ${formatRupiah(Math.abs(result.selisih))}`}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpenId(opened ? null : day.id)}>
                      {opened ? "Tutup" : "Lihat"}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => onOpen(day)}>
                      Buka lagi
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="col-span-2"
                      onClick={() => {
                        if (armed !== day.id) {
                          setArmed(day.id);
                          return;
                        }
                        onDelete(day.id);
                      }}
                    >
                      {armed === day.id ? "Yakin hapus dari HP" : "Hapus dari HP"}
                    </Button>
                  </div>
                  {opened && (
                    <div className="mt-3">
                      <Receipt day={day} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold">Kasbon</h2>
        {book.length === 0 ? (
          <p className="mt-2">Belum ada kasbon.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {book.map((person) => (
              <li key={person.person} className="rounded-xl border border-border bg-card p-3">
                <p className="font-bold">{person.person}</p>
                <p className={cn("money text-2xl", person.outstanding > 0 ? "text-short" : "text-primary")}>
                  {person.outstanding === 0
                    ? "Lunas"
                    : person.outstanding > 0
                      ? `Masih ${formatRupiah(person.outstanding)}`
                      : `Lebih bayar ${formatRupiah(Math.abs(person.outstanding))}`}
                </p>
                <ul className="mt-2 grid gap-1 text-sm">
                  {person.movements.map((movement, index) => (
                    <li key={`${movement.source}-${index}`}>
                      {movement.direction === "awal"
                        ? "Saldo awal"
                        : movement.direction === "keluar"
                          ? "Keluar"
                          : "Dibayar"}{" "}
                      {formatRupiah(movement.amount)} · {movement.source}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {days.length > 0 && (
        <Button type="button" variant="destructive" onClick={onDeleteAll}>
          Hapus semua data di HP ini
        </Button>
      )}
    </div>
  );
}
