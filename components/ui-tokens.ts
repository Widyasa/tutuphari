import { formatRupiah } from "@/lib/rupiah";

export function compactRb(amount: number): string {
  const abs = Math.abs(amount);
  if (abs % 1000 === 0) return `${abs / 1000}rb`;
  return formatRupiah(abs);
}

export function gapLabel(selisih: number | null): string {
  if (selisih == null) return "Belum dihitung";
  if (selisih === 0) return "Pas";
  return `${selisih < 0 ? "−" : "+"}${compactRb(selisih)}`;
}

export function toneClass(
  verdict: "kurang" | "pas" | "lebih" | "belum_dihitung" | null | undefined,
): string {
  if (verdict === "kurang") return "text-[var(--short)]";
  if (verdict === "pas") return "text-[var(--ok)]";
  return "text-foreground";
}

export function draftMoneyLabel(amount: number | null, negative: boolean): string {
  if (amount == null) return "Nominal belum diisi";
  return negative ? `−${formatRupiah(amount)}` : formatRupiah(amount);
}

export function unclearChip(entry: { item: string | null; amount: number | null }): string {
  const name = entry.item ?? "catatan";
  return entry.amount == null ? `${name} nominal belum diisi` : `${name} ${compactRb(entry.amount)}`;
}
