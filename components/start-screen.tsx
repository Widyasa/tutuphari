"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CASH_DISCLAIMER } from "@/lib/copy";
import { formatRupiah, parseMoneyInput } from "@/lib/rupiah";

const PRESETS = [100_000, 150_000, 200_000, 300_000];

function DrawerPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "drawer-scene relative p-5"
          : "drawer-scene relative min-h-[320px] p-7 md:min-h-[380px] lg:min-h-[520px] lg:p-9"
      }
    >
      <div className="relative z-[1] flex h-full flex-col justify-between gap-6 md:gap-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-white/65 uppercase">Cek laci</p>
          <p
            className={
              compact
                ? "mt-2 max-w-[18ch] text-xl font-bold tracking-[-0.04em] text-white"
                : "mt-3 max-w-[12ch] text-3xl font-bold tracking-[-0.04em] text-white lg:text-4xl"
            }
          >
            Satu angka yang jelas saat warung tutup.
          </p>
        </div>

        <div className="drawer-slot grid gap-3 p-4 md:gap-4 md:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-white/55 uppercase">
                Uang laci seharusnya
              </p>
              <p className={`money mt-1 font-bold text-white ${compact ? "text-2xl" : "text-3xl lg:text-4xl"}`}>
                Rp270.000
              </p>
            </div>
            <span className="rounded-md border border-emerald-200/30 bg-emerald-300/15 px-2.5 py-1 text-sm font-bold text-emerald-100">
              Pas
            </span>
          </div>
          <div className="grid gap-2 pt-1">
            <div className="bill w-full" />
            <div className="bill" />
            <div className="bill" />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-sm text-white/75 md:pt-4">
            <p>
              Omzet tunai
              <span className="money mt-0.5 block font-semibold text-white">Rp120.000</span>
            </p>
            <p>
              QRIS · bukan laci
              <span className="money mt-0.5 block font-semibold text-white">Rp10.000</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StartScreen({
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
    <main className="relative min-h-dvh w-full overflow-x-hidden">
      <div className="start-shell mx-auto grid min-h-dvh w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 md:gap-10 md:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:px-10 lg:py-0">
        <section className="flex flex-col justify-center">
          <p className="rise text-[1.75rem] font-bold tracking-[-0.04em] text-primary sm:text-[2rem]">TutupHari</p>
          <h1 className="rise rise-delay-1 mt-3 max-w-[14ch] text-[2.35rem] leading-[1.05] font-bold tracking-[-0.045em] text-foreground sm:text-[2.85rem] md:text-[3.25rem]">
            Catat kayak kirim pesan.
          </h1>
          <p className="rise rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Pas warung tutup, langsung tahu uang laci seharusnya berapa — dan selisih mana yang perlu dicek.
          </p>

          <div className="rise rise-delay-2 mt-6 md:hidden" aria-hidden>
            <DrawerPreview compact />
          </div>

          <form
            className="start-form rise rise-delay-3 mt-8 grid w-full gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (amount == null) return;
              onStart(name.trim() || "Warung saya", amount);
            }}
          >
            <div>
              <Label htmlFor="warung" className="text-sm font-semibold">
                Nama warung
              </Label>
              <Input
                id="warung"
                className="mt-2 h-12 bg-card/90"
                value={name}
                placeholder="Warung saya"
                autoComplete="organization"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="modal" className="text-sm font-semibold">
                Uang di laci sekarang
              </Label>
              <Input
                id="modal"
                inputMode="numeric"
                className="money mt-2 h-14 bg-card/90 text-2xl"
                value={modal}
                placeholder="contoh: 200000"
                onChange={(event) => setModal(event.target.value)}
              />
              {amount != null && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Modal awal <span className="money font-semibold text-foreground">{formatRupiah(amount)}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={amount === preset ? "default" : "outline"}
                  className="h-12 bg-card/80 px-1 text-sm"
                  onClick={() => setModal(String(preset))}
                >
                  {preset / 1000}rb
                </Button>
              ))}
            </div>
            <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={amount == null}>
              Mulai catat
            </Button>
          </form>

          <div className="rise rise-delay-3 mt-5 grid gap-3 sm:max-w-md">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 w-full bg-card/70"
              data-testid="start-demo"
              onClick={onDemo}
            >
              Coba demo
            </Button>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Contoh Warung Bu Komang, Denpasar. Angkanya sintetis — bukan transaksi sungguhan.
            </p>
            <p className="pt-2 text-sm leading-relaxed text-muted-foreground">{CASH_DISCLAIMER}</p>
          </div>
        </section>

        <aside className="rise rise-delay-2 hidden md:block" aria-hidden>
          <DrawerPreview />
        </aside>
      </div>
    </main>
  );
}
