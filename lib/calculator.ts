import type { Entry, EntryType, Method } from "@/lib/types";

const CASH_SIGN: Record<EntryType, number | null> = {
  penjualan: 1,
  kasbon_bayar: 1,
  setor: 1,
  pengeluaran_usaha: -1,
  ambil_pribadi: -1,
  kasbon_keluar: -1,
  tarik: -1,
  lainnya: null,
};

export type WhatIf = {
  entryId: string;
  sourceText: string;
  amount: number;
  method: Method;
  asTunaiSelisih: number;
  asQrisSelisih: number;
};

export type CloseResult = {
  modalAwal: number;
  penjualanTunai: number;
  penjualanQris: number;
  penjualanTransfer: number;
  pengeluaranTunai: number;
  ambilPribadiTunai: number;
  kasbonKeluarTunai: number;
  kasbonBayarTunai: number;
  setorTunai: number;
  tarikTunai: number;
  expectedCash: number;
  countedCash: number | null;
  selisih: number | null;
  verdict: "pas" | "kurang" | "lebih" | "belum_dihitung";
  countedQris: number | null;
  qrisSelisih: number | null;
  whatIfs: WhatIf[];
  pendingCount: number;
};

export function cashSign(type: EntryType): number | null {
  return CASH_SIGN[type];
}

export function countsAsCash(entry: Entry): boolean {
  return (
    entry.status === "confirmed" &&
    !entry.needsConfirmation &&
    entry.amount != null &&
    entry.amount > 0 &&
    entry.method === "tunai" &&
    cashSign(entry.type) != null
  );
}

export function closeDay(input: {
  modalAwal: number;
  entries: Entry[];
  countedCash: number | null;
  countedQris: number | null;
}): CloseResult {
  const modalAwal = Math.round(input.modalAwal);
  let penjualanTunai = 0;
  let penjualanQris = 0;
  let penjualanTransfer = 0;
  let pengeluaranTunai = 0;
  let ambilPribadiTunai = 0;
  let kasbonKeluarTunai = 0;
  let kasbonBayarTunai = 0;
  let setorTunai = 0;
  let tarikTunai = 0;
  let pendingCount = 0;

  for (const entry of input.entries) {
    if (entry.status !== "confirmed" || entry.needsConfirmation) pendingCount += 1;
    if (entry.status !== "confirmed" || entry.amount == null) continue;

    if (entry.type === "penjualan" && entry.method === "qris") {
      penjualanQris += entry.amount;
    }
    if (entry.type === "penjualan" && entry.method === "transfer") {
      penjualanTransfer += entry.amount;
    }
    if (!countsAsCash(entry) || entry.amount == null) continue;
    switch (entry.type) {
      case "penjualan":
        penjualanTunai += entry.amount;
        break;
      case "pengeluaran_usaha":
        pengeluaranTunai += entry.amount;
        break;
      case "ambil_pribadi":
        ambilPribadiTunai += entry.amount;
        break;
      case "kasbon_keluar":
        kasbonKeluarTunai += entry.amount;
        break;
      case "kasbon_bayar":
        kasbonBayarTunai += entry.amount;
        break;
      case "setor":
        setorTunai += entry.amount;
        break;
      case "tarik":
        tarikTunai += entry.amount;
        break;
      default:
        break;
    }
  }

  const expectedCash =
    modalAwal +
    penjualanTunai +
    kasbonBayarTunai +
    setorTunai -
    pengeluaranTunai -
    ambilPribadiTunai -
    kasbonKeluarTunai -
    tarikTunai;

  const countedCash =
    input.countedCash == null ? null : Math.round(input.countedCash);
  const selisih = countedCash == null ? null : countedCash - expectedCash;
  const verdict =
    selisih == null
      ? "belum_dihitung"
      : selisih === 0
        ? "pas"
        : selisih < 0
          ? "kurang"
          : "lebih";

  const countedQris =
    input.countedQris == null ? null : Math.round(input.countedQris);
  const qrisSelisih = countedQris == null ? null : countedQris - penjualanQris;

  const whatIfs: WhatIf[] = [];
  if (selisih != null) {
    for (const entry of input.entries) {
      if (entry.amount == null || entry.amount <= 0) continue;
      const sign = cashSign(entry.type);
      if (sign == null) continue;
      const stillOpen =
        entry.status !== "confirmed" || entry.method === "tidak_tahu";
      if (!stillOpen || countsAsCash(entry)) continue;
      const asTunaiExpected = expectedCash + sign * entry.amount;
      whatIfs.push({
        entryId: entry.id,
        sourceText: entry.sourceText,
        amount: entry.amount,
        method: entry.method,
        asTunaiSelisih: countedCash! - asTunaiExpected,
        asQrisSelisih: selisih,
      });
    }
  }

  return {
    modalAwal,
    penjualanTunai,
    penjualanQris,
    penjualanTransfer,
    pengeluaranTunai,
    ambilPribadiTunai,
    kasbonKeluarTunai,
    kasbonBayarTunai,
    setorTunai,
    tarikTunai,
    expectedCash,
    countedCash,
    selisih,
    verdict,
    countedQris,
    qrisSelisih,
    whatIfs,
    pendingCount,
  };
}
