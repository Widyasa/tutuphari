import type { CloseResult, WhatIf } from "@/lib/calculator";
import { AMOUNT_TOKEN_SOURCE, formatRupiah, parseAmountToken } from "@/lib/rupiah";
import { TYPE_LABEL, type Entry } from "@/lib/types";

function gapPhrase(selisih: number): string {
  if (selisih === 0) return "pas Rp0";
  const arah = selisih < 0 ? "kurang" : "lebih";
  return `${arah} ${formatRupiah(Math.abs(selisih))}`;
}

/**
 * Plain-language closing note. Uses only numbers the calculator already produced.
 * A leftover gap stays "belum terjelaskan".
 */
export function explainClose(result: CloseResult): string {
  if (result.countedCash == null || result.selisih == null) {
    return "Isi dulu uang yang kamu hitung di laci.";
  }

  const sentences: string[] = [];
  if (result.selisih === 0) {
    sentences.push(
      `Laci pas. Uang yang dihitung sama dengan yang seharusnya, ${formatRupiah(result.expectedCash)}.`,
    );
  } else {
    sentences.push(`Selisih ${gapPhrase(result.selisih)}.`);
  }

  if (result.penjualanQris > 0) {
    sentences.push(
      `QRIS tidak masuk laci. Omzet QRIS ${formatRupiah(result.penjualanQris)}.`,
    );
  }

  const unknown = result.whatIfs.filter((item) => item.method === "tidak_tahu");
  const unconfirmed = result.whatIfs.filter((item) => item.method !== "tidak_tahu");

  for (const item of unknown) {
    sentences.push(
      `Ada catatan belum jelas metodenya: "${item.sourceText}". Kalau itu tunai, selisih jadi ${gapPhrase(item.asTunaiSelisih)}. Kalau QRIS, selisih jadi ${gapPhrase(item.asQrisSelisih)}.`,
    );
  }
  for (const item of unconfirmed) {
    sentences.push(
      `Catatan belum dikonfirmasi dan belum masuk hitungan: "${item.sourceText}" ${formatRupiah(item.amount)}.`,
    );
  }

  if (result.selisih !== 0) {
    sentences.push(
      unknown.length > 0 || unconfirmed.length > 0
        ? "Angka yang masih tersisa setelah catatan itu belum terjelaskan."
        : "Belum terjelaskan. Tidak ada catatan yang masih menggantung untuk menutup angka ini.",
    );
  }

  return sentences.join(" ");
}

export function allowedExplainAmounts(
  result: CloseResult,
  entries: { amount: number | null }[] = [],
): number[] {
  const values = [
    result.modalAwal,
    result.penjualanTunai,
    result.penjualanQris,
    result.penjualanTransfer,
    result.penjualanTunai + result.penjualanQris + result.penjualanTransfer,
    result.pengeluaranTunai,
    result.ambilPribadiTunai,
    result.kasbonKeluarTunai,
    result.kasbonBayarTunai,
    result.setorTunai,
    result.tarikTunai,
    result.expectedCash,
    result.countedCash ?? 0,
    result.selisih == null ? 0 : Math.abs(result.selisih),
    result.countedQris ?? 0,
    result.qrisSelisih == null ? 0 : Math.abs(result.qrisSelisih),
    0,
  ];
  for (const entry of entries) {
    if (entry.amount != null) values.push(entry.amount);
  }
  for (const item of result.whatIfs) {
    values.push(item.amount, Math.abs(item.asTunaiSelisih), Math.abs(item.asQrisSelisih));
  }
  return [...new Set(values.map((value) => Math.round(value)))];
}

const METHOD_WORDS: { method: string; pattern: RegExp }[] = [
  { method: "qris", pattern: /\bqris\b/i },
  { method: "tunai", pattern: /\btunai\b|\bcash\b/i },
  { method: "transfer", pattern: /\btransfer\b/i },
];

export type MethodCheckEntry = {
  sourceText: string;
  item: string | null;
  method: string;
};

/**
 * True when a sentence assigns tunai, QRIS, or transfer to a note whose
 * recorded method is different. "Kalau/jika ..." stays allowed.
 */
export function explanationContradictsEntries(
  text: string,
  entries: MethodCheckEntry[],
): boolean {
  const parts = text
    .split(/(?<=[.!?])\s+|\s*(?:,|;)\s+|\s+\bdan\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    const asserted = assertedMethods(part);
    if (asserted.length === 0) continue;
    const referred = entries.filter((entry) => sentenceRefersTo(part, entry));
    if (referred.length === 1) {
      const entry = referred[0];
      if (asserted.some((method) => method !== entry.method)) return true;
      continue;
    }
    for (const entry of referred) {
      const source = entry.sourceText.trim().toLowerCase();
      if (source.length < 4 || !part.toLowerCase().includes(source)) continue;
      if (asserted.some((method) => method !== entry.method)) return true;
    }
  }
  return false;
}

function assertedMethods(sentence: string): string[] {
  const found: string[] = [];
  for (const { method, pattern } of METHOD_WORDS) {
    const match = pattern.exec(sentence);
    if (!match || match.index == null) continue;
    const before = sentence.slice(0, match.index);
    if (/\b(kalau|jika|bila|seandainya)\b/i.test(before)) continue;
    found.push(method);
  }
  return found;
}

function sentenceRefersTo(sentence: string, entry: MethodCheckEntry): boolean {
  const lower = sentence.toLowerCase();
  const source = entry.sourceText.trim().toLowerCase();
  if (source.length >= 4 && lower.includes(source)) return true;
  const item = entry.item?.trim().toLowerCase() ?? "";
  return item.length >= 4 && lower.includes(item);
}

const LEAKED_WORD = /tidak_tahu|whatifs|asqris|\bdraft\b/i;

/** True when a closing sentence echoes code names instead of warung language. */
export function explanationLeaksInternals(text: string): boolean {
  const trimmed = text.trim();
  if (/^kamu\s*,/i.test(trimmed)) return true;
  if (LEAKED_WORD.test(trimmed)) return true;
  if (trimmed.includes("_")) return true;
  if (/[a-z][A-Z]/.test(trimmed)) return true;
  return false;
}

function spokenMethod(entry: Entry): string {
  if (entry.status !== "confirmed" || entry.method === "tidak_tahu") return "belum jelas";
  if (entry.method === "qris") return "QRIS";
  if (entry.method === "transfer") return "transfer";
  return "tunai";
}

function whatIfLine(item: WhatIf): string {
  return `Kalau "${item.sourceText}" ternyata tunai, selisih jadi ${gapPhrase(item.asTunaiSelisih)}. Kalau ternyata QRIS, selisih jadi ${gapPhrase(item.asQrisSelisih)}.`;
}

/** Facts for the closing model, written in words. No enum keys or code names. */
export function explainUserPrompt(input: {
  warungName: string;
  result: CloseResult;
  entries: Entry[];
}): string {
  const { warungName, result, entries } = input;
  const lines = [
    `Nama warung: ${warungName}.`,
    result.countedCash == null || result.selisih == null
      ? "Uang yang dihitung belum diisi."
      : `Uang yang dihitung ${formatRupiah(result.countedCash)}. Seharusnya di laci ${formatRupiah(result.expectedCash)}. Selisih ${gapPhrase(result.selisih)}.`,
  ];
  if (result.penjualanQris > 0) {
    lines.push(`Omzet QRIS ${formatRupiah(result.penjualanQris)}. QRIS tidak masuk laci.`);
  }
  lines.push("Catatan hari ini:");
  for (const entry of entries) {
    if (entry.amount == null) continue;
    lines.push(
      `- "${entry.sourceText}": ${TYPE_LABEL[entry.type]}, cara bayar ${spokenMethod(entry)}, ${formatRupiah(entry.amount)}.`,
    );
  }
  if (result.whatIfs.length > 0) {
    lines.push("Perkiraan kalau cara bayar catatan yang belum jelas beda:");
    for (const item of result.whatIfs) lines.push(`- ${whatIfLine(item)}`);
  }
  lines.push("Tulis 2 atau 3 kalimat pendek. Jangan mulai dengan Kamu koma.");
  return lines.join("\n");
}

export function matchesExplainSchema(data: unknown): data is { explanation: string } {
  return (
    !!data &&
    typeof data === "object" &&
    typeof (data as { explanation?: unknown }).explanation === "string" &&
    (data as { explanation: string }).explanation.trim().length > 0
  );
}

/** Reject an AI paragraph that cites a rupiah figure we did not compute. */
export function aiTextIsGrounded(text: string, allowed: number[]): boolean {
  const found = amountsMentioned(text);
  if (found.length === 0) return false;
  return found.every((amount) => allowed.includes(amount));
}

function amountsMentioned(text: string): number[] {
  const pattern = new RegExp(AMOUNT_TOKEN_SOURCE, "gi");
  const found: number[] = [];
  for (const match of text.matchAll(pattern)) {
    const amount = parseAmountToken(match[0]);
    if (amount != null) found.push(amount);
  }
  return found;
}
