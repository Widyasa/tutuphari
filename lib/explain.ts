import type { CloseResult } from "@/lib/calculator";
import { formatRupiah } from "@/lib/rupiah";

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

export function allowedExplainAmounts(result: CloseResult): number[] {
  const values = [
    result.modalAwal,
    result.penjualanTunai,
    result.penjualanQris,
    result.penjualanTransfer,
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
  for (const item of result.whatIfs) {
    values.push(item.amount, Math.abs(item.asTunaiSelisih), Math.abs(item.asQrisSelisih));
  }
  return [...new Set(values.map((value) => Math.round(value)))];
}

/** Reject an AI paragraph that cites a rupiah figure we did not compute. */
export function aiTextIsGrounded(text: string, allowed: number[]): boolean {
  const matches = [...text.matchAll(/rp\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]+)/gi)];
  if (matches.length === 0) return false;
  return matches.every((match) => {
    const amount = Number(match[1].replace(/\./g, ""));
    return allowed.includes(amount);
  });
}
