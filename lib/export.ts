import { closeDay } from "@/lib/calculator";
import { explainClose } from "@/lib/explain";
import { formatLongDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/rupiah";
import { CASH_DISCLAIMER } from "@/lib/copy";
import { METHOD_LABEL, TYPE_LABEL, type DayRecord } from "@/lib/types";

function cell(value: string | number | null): string {
  const raw = value == null ? "" : String(value);
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(day: DayRecord): string {
  const header = [
    "tanggal",
    "warung",
    "jenis",
    "metode",
    "nominal",
    "qty",
    "item",
    "lawan",
    "status",
    "parser",
    "catatan_sumber",
  ];
  const rows = day.entries.map((entry) =>
    [
      day.date,
      day.warungName,
      TYPE_LABEL[entry.type],
      METHOD_LABEL[entry.method],
      entry.amount ?? "",
      entry.qty ?? "",
      entry.item ?? "",
      entry.counterparty ?? "",
      entry.status,
      entry.parser,
      entry.sourceText,
    ]
      .map(cell)
      .join(","),
  );
  return `\uFEFF${header.join(",")}\n${rows.join("\n")}\n`;
}

export function toWhatsApp(day: DayRecord): string {
  const result = closeDay({
    modalAwal: day.modalAwal,
    entries: day.entries,
    countedCash: day.countedCash,
    countedQris: day.countedQris,
  });
  const lines = [
    day.isDemo ? "TutupHari — CONTOH" : "TutupHari",
    `${day.warungName}${day.place ? `, ${day.place}` : ""}`,
    formatLongDate(day.date),
    "",
    `Modal awal: ${formatRupiah(day.modalAwal)}`,
    `Omzet tunai: ${formatRupiah(result.penjualanTunai)}`,
    `Omzet QRIS: ${formatRupiah(result.penjualanQris)}`,
    `Pengeluaran tunai: ${formatRupiah(result.pengeluaranTunai)}`,
    `Ambil pribadi: ${formatRupiah(result.ambilPribadiTunai)}`,
    `Kasbon keluar: ${formatRupiah(result.kasbonKeluarTunai)}`,
    `Kasbon dibayar: ${formatRupiah(result.kasbonBayarTunai)}`,
    "",
    `Uang laci seharusnya: ${formatRupiah(result.expectedCash)}`,
    result.countedCash == null
      ? "Uang dihitung: belum diisi"
      : `Uang dihitung: ${formatRupiah(result.countedCash)}`,
    result.selisih == null
      ? "Selisih: belum dihitung"
      : result.selisih === 0
        ? "Selisih: pas Rp0"
        : `Selisih: ${result.selisih < 0 ? "kurang" : "lebih"} ${formatRupiah(Math.abs(result.selisih))}`,
    "",
    explainClose(result),
    "",
    CASH_DISCLAIMER,
  ];
  return lines.join("\n");
}
