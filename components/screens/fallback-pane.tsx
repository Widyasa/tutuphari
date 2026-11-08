"use client";

import { MethodChoice } from "@/components/screens/method-choice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FallbackPane({
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
    <div className="rise">
      <h1 className="text-2xl font-bold tracking-[-0.03em] md:text-3xl">Isi manual</h1>
      <p className="alert-surface mt-3 text-sm">AI tidak merespons. Isi jumlah dan cara bayar sendiri.</p>
      <div className="surface mt-4 p-4 md:p-5">
        <Label htmlFor="manual-amount" className="block text-sm font-semibold">
          Jumlah (rupiah)
        </Label>
        <Input
          id="manual-amount"
          inputMode="numeric"
          className="money mt-2 h-14 bg-background/70 text-2xl"
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
        />
        <MethodChoice method={method} onMethod={onMethod} />
      </div>
    </div>
  );
}
