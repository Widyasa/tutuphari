import { closeDay, type CloseResult } from "@/lib/calculator";
import { formatRupiah } from "@/lib/rupiah";
import type { DayRecord } from "@/lib/types";
import { cn } from "cn";

const VERDICT = {
  pas: "Pas",
  kurang: "Kurang",
  lebih: "Lebih",
  belum_dihitung: "Belum dihitung",
} as const;

export function Receipt({ day }: { day: DayRecord }) {
  const result = closeDay({
    modalAwal: day.modalAwal,
    entries: day.entries,
    countedCash: day.countedCash,
    countedQris: day.countedQris,
  });

  const rows: { label: string; amount: number }[] = [
    { label: "Modal awal", amount: result.modalAwal },
    { label: "Penjualan tunai", amount: result.penjualanTunai },
    { label: "Kasbon dibayar, tunai", amount: result.kasbonBayarTunai },
    { label: "Setor modal", amount: result.setorTunai },
    { label: "Pengeluaran tunai", amount: -result.pengeluaranTunai },
    { label: "Ambil pribadi", amount: -result.ambilPribadiTunai },
    { label: "Kasbon keluar, tunai", amount: -result.kasbonKeluarTunai },
    { label: "Tarik / ke bank", amount: -result.tarikTunai },
  ].filter((row) => row.label === "Modal awal" || row.amount !== 0);

  return (
    <div>
      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-dashed border-border py-2"
          >
            <dt>{row.label}</dt>
            <dd className="money text-lg">{formatRupiah(row.amount)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="font-bold">Seharusnya di laci</dt>
          <dd className="money text-3xl">{formatRupiah(result.expectedCash)}</dd>
        </div>
      </dl>

      <Verdict result={result} />

      {result.pendingCount > 0 && (
        <p className="mt-3 text-base">
          {result.pendingCount} catatan belum masuk hitungan. Konfirmasi dulu di Catat.
        </p>
      )}

      <section className="mt-4 rounded-xl bg-qris/10 p-3 text-qris">
        <h3 className="font-bold">QRIS, tidak masuk laci</h3>
        <p className="money mt-1 text-2xl">{formatRupiah(result.penjualanQris)}</p>
        {result.countedQris != null && (
          <p className="mt-1 text-base text-foreground">
            Di aplikasi QRIS {formatRupiah(result.countedQris)}.{" "}
            {result.qrisSelisih === 0
              ? "Pas."
              : result.qrisSelisih != null && result.qrisSelisih < 0
                ? `Kurang ${formatRupiah(Math.abs(result.qrisSelisih))}.`
                : `Lebih ${formatRupiah(result.qrisSelisih ?? 0)}.`}
          </p>
        )}
        {result.penjualanTransfer > 0 && (
          <p className="mt-2 text-base text-foreground">
            Transfer {formatRupiah(result.penjualanTransfer)}, juga di luar laci.
          </p>
        )}
      </section>
    </div>
  );
}

function Verdict({ result }: { result: CloseResult }) {
  const tone =
    result.verdict === "kurang"
      ? "bg-short/10 text-short"
      : result.verdict === "lebih"
        ? "bg-over/10 text-over"
        : result.verdict === "pas"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-foreground";

  return (
    <div className={cn("mt-3 rounded-xl px-4 py-3", tone)}>
      <p className="font-bold">{VERDICT[result.verdict]}</p>
      <p className="money text-4xl leading-tight">
        {result.selisih == null ? "Isi hitungan" : formatRupiah(Math.abs(result.selisih))}
      </p>
      <p className="mt-1 text-base text-foreground">
        {result.countedCash == null
          ? "Uang yang kamu hitung belum diisi."
          : `Dihitung ${formatRupiah(result.countedCash)} · seharusnya ${formatRupiah(result.expectedCash)}.`}
      </p>
    </div>
  );
}
