import { describe, expect, it } from "vitest";
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
  it("drops a name and a payment method that the chosen type does not show", () => {
    expect(normalizeDraftEdit({
      type: "penjualan",
      amount: 15_000,
      method: "qris",
      name: "Bu Qatest",
    })).toEqual({ type: "penjualan", amount: 15_000, method: "qris", counterparty: null });
    expect(normalizeDraftEdit({
      type: "lainnya",
      amount: 15_000,
      method: "tunai",
      name: "Bu Qatest",
    }).method).toBe("tidak_tahu");
    expect(normalizeDraftEdit({
      type: "kasbon_bayar",
      amount: 20_000,
      method: "tunai",
      name: "  Bu   Qatest ",
    }).counterparty).toBe("Bu Qatest");
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
