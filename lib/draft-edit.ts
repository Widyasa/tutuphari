import { assessRepayment, draftPaymentAlert, personBalance } from "@/lib/kasbon";
import type { DayRecord, Entry, EntryType, Method } from "@/lib/types";

const METHOD_TYPES: ReadonlySet<EntryType> = new Set([
  "penjualan",
  "pengeluaran_usaha",
  "ambil_pribadi",
  "kasbon_keluar",
  "kasbon_bayar",
]);

const NAME_TYPES: ReadonlySet<EntryType> = new Set(["kasbon_keluar", "kasbon_bayar"]);

export function draftShowsMethod(type: EntryType): boolean {
  return METHOD_TYPES.has(type);
}

export function draftShowsName(type: EntryType): boolean {
  return NAME_TYPES.has(type);
}

export function normalizeDraftEdit(input: {
  type: EntryType;
  amount: number;
  method: Method;
  name: string;
}): { type: EntryType; amount: number; method: Method; counterparty: string | null } {
  const name = input.name.trim().replace(/\s+/g, " ");
  return {
    type: input.type,
    amount: Math.round(input.amount),
    method: input.method,
    counterparty: draftShowsName(input.type) ? name || null : null,
  };
}

export function draftConfirmBlock(
  entry: Pick<Entry, "type" | "amount" | "method" | "counterparty" | "status">,
  days: DayRecord[],
): { title: "Belum bisa dikonfirmasi"; detail: string } | null {
  if (entry.status === "confirmed") return null;
  if (entry.amount == null || entry.amount <= 0) {
    return {
      title: "Belum bisa dikonfirmasi",
      detail: "Jumlah belum diisi. Draft belum masuk perhitungan.",
    };
  }
  if (entry.type === "lainnya") {
    return {
      title: "Belum bisa dikonfirmasi",
      detail: "Jenis catatan belum diketahui. Draft belum masuk perhitungan.",
    };
  }
  if (draftShowsName(entry.type) && !entry.counterparty?.trim()) {
    return {
      title: "Belum bisa dikonfirmasi",
      detail: "Nama belum diisi. Draft belum masuk perhitungan.",
    };
  }
  if (draftShowsMethod(entry.type) && entry.method === "tidak_tahu") {
    return {
      title: "Belum bisa dikonfirmasi",
      detail: "Cara bayar belum diketahui. Draft belum masuk perhitungan.",
    };
  }
  if (entry.type === "kasbon_bayar" && entry.counterparty) {
    const balance = personBalance(days, entry.counterparty);
    const decision = assessRepayment({ days, person: entry.counterparty, amount: entry.amount });
    if (!decision.ok) {
      return {
        title: "Belum bisa dikonfirmasi",
        detail: draftPaymentAlert({
          person: entry.counterparty,
          amount: entry.amount,
          knownPerson: balance.knownPerson,
          decision,
        }).detail,
      };
    }
  }
  return null;
}
