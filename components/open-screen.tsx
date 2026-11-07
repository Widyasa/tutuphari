"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyField } from "@/components/money-field";
import { CASH_DISCLAIMER } from "@/lib/copy";

const PRESETS = [100_000, 150_000, 200_000, 300_000];

export function OpenScreen({
  onStart,
  onDemo,
}: {
  onStart: (warungName: string, modalAwal: number) => void;
  onDemo: () => void;
}) {
  const [name, setName] = useState("");
  const [modal, setModal] = useState<number | null>(null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <p className="font-bold text-primary">TutupHari</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight">
        Catat kayak kirim pesan.
      </h1>
      <p className="mt-2 text-lg">
        Pas warung tutup, langsung tahu uang laci seharusnya berapa dan selisih mana yang perlu dicek.
      </p>

      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (modal == null) return;
          onStart(name, modal);
        }}
      >
        <div>
          <Label htmlFor="warung" className="text-base">
            Nama warung
          </Label>
          <Input
            id="warung"
            className="mt-2"
            placeholder="Warung saya"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <MoneyField
          id="modal-awal"
          label="Uang di laci sekarang"
          value={modal}
          onChange={setModal}
          large
          hint="Ini modal awal. Kalau laci kosong, tulis 0."
        />
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((amount) => (
            <Button
              key={amount}
              type="button"
              variant={modal === amount ? "default" : "outline"}
              onClick={() => setModal(amount)}
            >
              {amount / 1000}rb
            </Button>
          ))}
        </div>
        <Button type="submit" size="lg" disabled={modal == null}>
          Mulai catat
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-6">
        <Button type="button" variant="outline" className="w-full" size="lg" onClick={onDemo}>
          Coba demo
        </Button>
        <p className="mt-2 text-sm">
          Contoh Warung Bu Komang, Denpasar. Angkanya sintetis, bukan transaksi sungguhan.
        </p>
      </div>

      <p className="pt-8 pb-8 text-sm">
        {CASH_DISCLAIMER}
      </p>
    </main>
  );
}
