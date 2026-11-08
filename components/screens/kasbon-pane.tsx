"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRupiah, parseMoneyInput } from "@/lib/rupiah";

function kasbonHint(row: {
  outstanding: number;
  movements: { source: string; direction: string; amount: number }[];
}): string {
  const paid = [...row.movements].reverse().find((move) => move.direction === "bayar");
  if (paid && row.outstanding > 0) return `Sisa setelah bayar ${formatRupiah(paid.amount)}`;
  return [...row.movements].reverse().find((move) => move.direction !== "awal")?.source ?? row.movements.at(-1)?.source ?? "";
}

export function KasbonPane({
  people,
  total,
  demo,
  payOpen,
  payName,
  payAmount,
  payError,
  onToggle,
  onName,
  onAmount,
  onSave,
}: {
  people: { person: string; outstanding: number; movements: { source: string; direction: string; amount: number }[] }[];
  total: number;
  demo: boolean;
  payOpen: boolean;
  payName: string;
  payAmount: string;
  payError: string | null;
  onToggle: () => void;
  onName: (value: string) => void;
  onAmount: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="rise">
      <h1 className="text-2xl font-bold tracking-[-0.03em] md:text-3xl">Buku kasbon</h1>
      <p className="mt-1 text-sm text-muted-foreground">Saldo lintas hari{demo ? " · Data demo" : ""}</p>
      <div className="surface-hero mt-4 p-5">
        <p className="eyebrow">Total belum lunas</p>
        <p className="money mt-1 text-4xl font-bold text-[var(--kasbon)] md:text-5xl">{formatRupiah(total)}</p>
      </div>
      {people.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Belum ada kasbon yang belum lunas.</p>}
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {people.map((row) => (
          <li key={row.person} className="surface p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">{row.person}</p>
              <p className="money font-bold text-[var(--kasbon)]">{formatRupiah(row.outstanding)}</p>
            </div>
            <p className="text-sm text-muted-foreground">{kasbonHint(row)}</p>
          </li>
        ))}
      </ul>
      {payOpen && (
        <div className="surface mt-4 grid gap-3 p-4">
          <div>
            <Label htmlFor="pay-name">Nama</Label>
            <Input
              id="pay-name"
              className="mt-2 h-12"
              value={payName}
              placeholder="contoh: Bu Wayan"
              onChange={(event) => onName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pay-amount">Jumlah yang dibayar</Label>
            <Input
              id="pay-amount"
              inputMode="numeric"
              className="mt-2 h-12"
              value={payAmount}
              placeholder="contoh: 10000"
              onChange={(event) => onAmount(event.target.value)}
            />
          </div>
          <Button type="button" variant="outline" className="h-12" onClick={onToggle}>
            Batal
          </Button>
          {payError && (
            <p role="alert" className="text-sm font-semibold text-[var(--short)]">
              {payError}
            </p>
          )}
        </div>
      )}
      <div className="mt-4">
        {!payOpen ? (
          <Button type="button" className="h-12 w-full" data-testid="primary-cta" onClick={onToggle}>
            Catat bayar kasbon
          </Button>
        ) : (
          <Button
            type="button"
            className="h-12 w-full"
            data-testid="primary-cta"
            disabled={!payName.trim() || parseMoneyInput(payAmount) == null}
            onClick={onSave}
          >
            Simpan pembayaran
          </Button>
        )}
      </div>
    </div>
  );
}
