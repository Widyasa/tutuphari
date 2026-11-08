"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CASH_DISCLAIMER } from "@/lib/copy";
import { formatRupiah, parseMoneyInput } from "@/lib/rupiah";

const PRESETS = [100_000, 150_000, 200_000, 300_000];

function ReceiptPreview() {
  return (
    <div className="drawer-scene p-5 md:p-6" aria-hidden>
      <p className="eyebrow">Contoh hasil</p>
      <p className="mt-3 text-sm text-muted-foreground">Uang laci seharusnya</p>
      <p className="money mt-1 text-3xl font-semibold md:text-4xl">Rp270.000</p>
      <p className="ok-text mt-2 text-base font-bold">Pas</p>
      <div className="drawer-slot mt-4 grid gap-2 p-3 text-sm">
        <p className="flex justify-between gap-3">
          <span className="text-muted-foreground">Omzet tunai</span>
          <span className="money font-semibold">Rp120.000</span>
        </p>
        <p className="flex justify-between gap-3">
          <span className="text-muted-foreground">QRIS · bukan laci</span>
          <span className="money font-semibold">Rp10.000</span>
        </p>
      </div>
    </div>
  );
}

function StartForm({
  name,
  modal,
  amount,
  onName,
  onModal,
  onStart,
  onDemo,
}: {
  name: string;
  modal: string;
  amount: number | null;
  onName: (value: string) => void;
  onModal: (value: string) => void;
  onStart: (name: string, modal: number) => void;
  onDemo: () => void;
}) {
  return (
    <div className="rise rise-delay-2">
      <form
        className="start-form grid w-full gap-4"
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
            className="mt-2 h-12 bg-card"
            value={name}
            placeholder="Warung saya"
            autoComplete="organization"
            onChange={(event) => onName(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="modal" className="text-sm font-semibold">
            Uang di laci sekarang
          </Label>
          <Input
            id="modal"
            inputMode="numeric"
            className="money mt-2 h-14 bg-card text-2xl"
            value={modal}
            placeholder="contoh: 200000"
            onChange={(event) => onModal(event.target.value)}
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
              className="h-12 bg-card px-1 text-sm"
              onClick={() => onModal(String(preset))}
            >
              {preset / 1000}rb
            </Button>
          ))}
        </div>
        <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={amount == null}>
          Mulai catat
        </Button>
      </form>

      <div className="mt-5 grid gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 w-full bg-card"
          data-testid="start-demo"
          onClick={onDemo}
        >
          Coba demo
        </Button>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Contoh Warung Bu Komang, Denpasar. Angkanya sintetis — bukan transaksi sungguhan.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">{CASH_DISCLAIMER}</p>
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
      {/* Desktop split */}
      <div className="hidden min-h-dvh lg:grid lg:grid-cols-2">
        <section className="landing-board flex flex-col justify-center px-12 py-16 xl:px-16">
          <div className="max-w-lg">
            <p className="rise text-3xl font-bold tracking-[-0.03em] xl:text-4xl">TutupHari</p>
            <h1 className="rise rise-delay-1 mt-5 text-5xl leading-[1.05] font-bold tracking-[-0.035em] xl:text-6xl">
              Catat kayak kirim pesan.
            </h1>
            <p className="rise rise-delay-2 mt-5 max-w-md text-lg leading-relaxed text-white/85">
              Pas warung tutup, langsung tahu uang laci seharusnya berapa dan selisih mana yang perlu dicek.
            </p>
            <p className="rise rise-delay-3 mt-8 text-sm text-white/70">Tanpa akun · Tanpa POS · Cuma cek laci</p>
          </div>
        </section>

        <section className="flex items-center px-10 py-12 xl:px-14">
          <div className="mx-auto grid w-full max-w-md gap-8">
            <ReceiptPreview />
            <StartForm
              name={name}
              modal={modal}
              amount={amount}
              onName={setName}
              onModal={setModal}
              onStart={onStart}
              onDemo={onDemo}
            />
          </div>
        </section>
      </div>

      {/* Mobile + tablet */}
      <div className="lg:hidden">
        <div className="start-shell mx-auto max-w-xl px-4 py-8 sm:px-6 md:max-w-[720px] md:py-12">
          <p className="rise text-2xl font-bold tracking-[-0.03em] text-primary sm:text-3xl">TutupHari</p>
          <h1 className="rise rise-delay-1 mt-3 max-w-[14ch] text-[2.25rem] leading-[1.05] font-bold tracking-[-0.035em] sm:text-4xl md:text-5xl">
            Catat kayak kirim pesan.
          </h1>
          <p className="rise rise-delay-1 mt-3 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Pas warung tutup, langsung tahu uang laci seharusnya berapa dan selisih mana yang perlu dicek.
          </p>

          <div className="rise rise-delay-2 mt-6 md:mt-8">
            <ReceiptPreview />
          </div>

          <div className="mt-8">
            <StartForm
              name={name}
              modal={modal}
              amount={amount}
              onName={setName}
              onModal={setModal}
              onStart={onStart}
              onDemo={onDemo}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
