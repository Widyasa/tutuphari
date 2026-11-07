import { describe, expect, it } from "vitest";
import { closeDay } from "@/lib/calculator";
import { createDay } from "@/lib/day";
import { draftConfirmBlock, normalizeDraftEdit } from "@/lib/draft-edit";
import type { Entry } from "@/lib/types";

function entry(partial: Partial<Entry> & Pick<Entry, "type" | "method">): Entry {
  return {
    id: "e",
    noteId: "n",
    amount: 10_000,
    item: null,
    qty: null,
    counterparty: null,
    confidence: 1,
    sourceText: "catatan asli",
    needsConfirmation: false,
    question: null,
    parser: "rule",
    status: "draft",
    ...partial,
  };
}

describe("draft editing", () => {
  it("keeps the payment method when only the amount is edited", () => {
    expect(normalizeDraftEdit({
      type: "penjualan",
      amount: 15_000,
      method: "qris",
      name: "Bu Qatest",
    })).toEqual({ type: "penjualan", amount: 15_000, method: "qris", counterparty: null });
    expect(normalizeDraftEdit({
      type: "setor",
      amount: 60_000,
      method: "qris",
      name: "",
    }).method).toBe("qris");
    expect(normalizeDraftEdit({
      type: "tarik",
      amount: 40_000,
      method: "transfer",
      name: "",
    }).method).toBe("transfer");
    expect(normalizeDraftEdit({
      type: "lainnya",
      amount: 15_000,
      method: "tunai",
      name: "Bu Qatest",
    }).method).toBe("tunai");
    expect(normalizeDraftEdit({
      type: "kasbon_bayar",
      amount: 20_000,
      method: "tunai",
      name: "  Bu   Qatest ",
    }).counterparty).toBe("Bu Qatest");
  });

  it("does not put a non-cash setor or tarik into the drawer after the amount changes", () => {
    const setor = normalizeDraftEdit({ type: "setor", amount: 60_000, method: "qris", name: "" });
    const tarik = normalizeDraftEdit({ type: "tarik", amount: 40_000, method: "transfer", name: "" });
    const other = normalizeDraftEdit({ type: "lainnya", amount: 15_000, method: "tunai", name: "" });
    const result = closeDay({
      modalAwal: 200_000,
      countedCash: 200_000,
      countedQris: null,
      entries: [
        entry({ id: "setor", type: setor.type, method: setor.method, amount: setor.amount, status: "confirmed" }),
        entry({ id: "tarik", type: tarik.type, method: tarik.method, amount: tarik.amount, status: "confirmed" }),
        entry({ id: "other", type: other.type, method: other.method, amount: other.amount, status: "draft" }),
      ],
    });
    expect(result.setorTunai).toBe(0);
    expect(result.tarikTunai).toBe(0);
    expect(result.expectedCash).toBe(200_000);
  });

  it("refuses an incomplete draft and an over-debt payment without confirming it", () => {
    const day = createDay({ warungName: "QA", modalAwal: 200_000, now: new Date("2026-11-07T03:00:00Z") });
    day.entries = [
      entry({ id: "debt", type: "kasbon_keluar", method: "tunai", amount: 30_000, counterparty: "Bu Qatest", status: "confirmed" }),
      entry({ id: "part", type: "kasbon_bayar", method: "tunai", amount: 10_000, counterparty: "Bu Qatest", status: "confirmed" }),
    ];
    expect(draftConfirmBlock(entry({ type: "penjualan", method: "tidak_tahu" }), [day])?.detail).toContain("Cara bayar belum diketahui");
    expect(draftConfirmBlock(entry({ type: "lainnya", method: "tidak_tahu" }), [day])?.detail).toContain("Jenis catatan belum diketahui");
    expect(draftConfirmBlock(entry({ type: "kasbon_keluar", method: "tunai", counterparty: null }), [day])?.detail).toContain("Nama belum diisi");
    const raised = entry({ type: "kasbon_bayar", method: "tunai", amount: 25_000, counterparty: "Bu Qatest" });
    expect(draftConfirmBlock(raised, [day])?.detail).toBe("Rp25.000 melebihi sisa utang Rp20.000. Draft belum masuk perhitungan.");
    expect(draftConfirmBlock(entry({ type: "penjualan", method: "tunai", amount: 15_000, status: "confirmed" }), [day])).toBeNull();
  });
});
