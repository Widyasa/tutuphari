import { formatRupiah } from "@/lib/rupiah";
import type { DayRecord } from "@/lib/types";

export type KasbonMovement = {
  date: string;
  person: string;
  direction: "awal" | "keluar" | "bayar";
  amount: number;
  source: string;
  demo: boolean;
};

export type KasbonPerson = {
  person: string;
  outstanding: number;
  movements: KasbonMovement[];
};

function keyOf(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function kasbonBook(days: DayRecord[]): KasbonPerson[] {
  const rows = new Map<string, KasbonPerson>();

  const ensure = (name: string) => {
    const key = keyOf(name);
    const display = name.trim().replace(/\s+/g, " ");
    let row = rows.get(key);
    if (!row) {
      row = { person: display, outstanding: 0, movements: [] };
      rows.set(key, row);
    }
    return row;
  };

  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const day of ordered) {
    for (const prior of day.priorKasbon) {
      const row = ensure(prior.person);
      row.outstanding += prior.amount;
      row.movements.push({
        date: day.date,
        person: row.person,
        direction: "awal",
        amount: prior.amount,
        source: prior.note,
        demo: day.isDemo,
      });
    }
    for (const entry of day.entries) {
      if (entry.status !== "confirmed" || entry.needsConfirmation || entry.amount == null) {
        continue;
      }
      if (entry.type !== "kasbon_keluar" && entry.type !== "kasbon_bayar") continue;
      if (!entry.counterparty) continue;
      const row = ensure(entry.counterparty);
      const direction = entry.type === "kasbon_keluar" ? "keluar" : "bayar";
      row.outstanding += direction === "keluar" ? entry.amount : -entry.amount;
      row.movements.push({
        date: day.date,
        person: row.person,
        direction,
        amount: entry.amount,
        source: entry.sourceText,
        demo: day.isDemo,
      });
    }
  }

  return [...rows.values()].sort(
    (a, b) => b.outstanding - a.outstanding || a.person.localeCompare(b.person, "id"),
  );
}

export type RepaymentDecision =
  | {
      ok: true;
      person: string;
      amount: number;
      outstanding: number;
      remainingAfter: number;
    }
  | {
      ok: false;
      reason: "no_active_debt" | "exceeds_remaining";
      person: string;
      outstanding: number;
      message: string;
    };

/** Accept a cash repayment only when it fits the debt still owed to this exact name. */
export function assessRepayment(input: {
  days: DayRecord[];
  person: string;
  amount: number;
}): RepaymentDecision {
  const person = input.person.trim().replace(/\s+/g, " ");
  const amount = Math.round(input.amount);
  const row = kasbonBook(input.days).find((item) => keyOf(item.person) === keyOf(person));
  const outstanding = row?.outstanding ?? 0;
  if (outstanding <= 0) {
    return {
      ok: false,
      reason: "no_active_debt",
      person,
      outstanding,
      message: `${person} tidak punya utang aktif. Pembayaran tidak dicatat.`,
    };
  }
  if (amount > outstanding) {
    return {
      ok: false,
      reason: "exceeds_remaining",
      person,
      outstanding,
      message: `Pembayaran ${formatRupiah(amount)} melebihi sisa utang ${formatRupiah(outstanding)}. Pembayaran tidak dicatat.`,
    };
  }
  return {
    ok: true,
    person,
    amount,
    outstanding,
    remainingAfter: outstanding - amount,
  };
}
