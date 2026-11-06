import { describe, expect, it } from "vitest";
import { closeDay } from "@/lib/calculator";
import { createDemoDay, DEMO_COUNTED_CASH } from "@/lib/demo";
import { explainClose } from "@/lib/explain";
import { toCsv, toWhatsApp } from "@/lib/export";
import { kasbonBook } from "@/lib/kasbon";
import type { Entry } from "@/lib/types";

function cashEntry(partial: Partial<Entry> & Pick<Entry, "type" | "amount" | "method">): Entry {
  return {
    id: partial.id ?? "e",
    noteId: "n",
    item: null,
    qty: null,
    counterparty: null,
    confidence: 0.9,
    sourceText: "catatan",
    needsConfirmation: false,
    question: null,
    parser: "rule",
    status: "confirmed",
    ...partial,
  };
}

describe("closeDay", () => {
  it("keeps QRIS out of the drawer and ignores unconfirmed cash", () => {
    const result = closeDay({
      modalAwal: 100_000,
      countedCash: 120_000,
      countedQris: null,
      entries: [
        cashEntry({ type: "penjualan", amount: 30_000, method: "tunai" }),
        cashEntry({
          id: "q",
          type: "penjualan",
          amount: 99_000,
          method: "qris",
        }),
        cashEntry({
          id: "draft",
          type: "penjualan",
          amount: 50_000,
          method: "tunai",
          status: "draft",
        }),
        cashEntry({
          id: "out",
          type: "pengeluaran_usaha",
          amount: 10_000,
          method: "tunai",
        }),
      ],
    });

    expect(result.expectedCash).toBe(120_000);
    expect(result.selisih).toBe(0);
    expect(result.penjualanQris).toBe(99_000);
    expect(result.verdict).toBe("pas");
  });

  it("names a shortage that nothing in the notes explains", () => {
    const result = closeDay({
      modalAwal: 50_000,
      countedCash: 40_000,
      countedQris: null,
      entries: [],
    });
    expect(result.selisih).toBe(-10_000);
    expect(result.verdict).toBe("kurang");
    expect(explainClose(result).toLowerCase()).toContain("belum terjelaskan");
  });

  it("closes the demo gap only after the ambiguous note is tunai", () => {
    const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
    const before = closeDay(day);
    expect(before.expectedCash).toBe(255_000);
    expect(before.countedCash).toBe(DEMO_COUNTED_CASH);
    expect(before.selisih).toBe(15_000);
    expect(before.penjualanQris).toBe(10_000);
    expect(before.qrisSelisih).toBe(0);

    const beforeText = explainClose(before);
    expect(beforeText).toContain("es jeruk 15rb");
    expect(beforeText.toLowerCase()).toContain("belum terjelaskan");
    expect(beforeText).toContain("Rp0");

    const resolved = {
      ...day,
      entries: day.entries.map((entry) =>
        entry.id === "demo-entry-7"
          ? {
              ...entry,
              method: "tunai" as const,
              status: "confirmed" as const,
              needsConfirmation: false,
            }
          : entry,
      ),
    };
    const after = closeDay(resolved);
    expect(after.expectedCash).toBe(270_000);
    expect(after.selisih).toBe(0);
    expect(after.verdict).toBe("pas");
    expect(explainClose(after).toLowerCase()).toContain("laci pas");
    expect(explainClose(after).toLowerCase()).not.toContain("belum terjelaskan");

    const asQris = {
      ...day,
      entries: day.entries.map((entry) =>
        entry.id === "demo-entry-7"
          ? {
              ...entry,
              method: "qris" as const,
              status: "confirmed" as const,
              needsConfirmation: false,
            }
          : entry,
      ),
    };
    const stillOpen = closeDay(asQris);
    expect(stillOpen.expectedCash).toBe(255_000);
    expect(stillOpen.selisih).toBe(15_000);
    expect(stillOpen.penjualanQris).toBe(25_000);
    expect(explainClose(stillOpen).toLowerCase()).toContain("belum terjelaskan");
  });
});

describe("kasbon and export", () => {
  it("carries Pak Made to zero and leaves Bu Wayan outstanding", () => {
    const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
    const book = kasbonBook([day]);
    const made = book.find((row) => row.person === "Pak Made");
    const wayan = book.find((row) => row.person === "Bu Wayan");
    expect(made?.outstanding).toBe(0);
    expect(wayan?.outstanding).toBe(10_000);
  });

  it("builds WhatsApp text and guards CSV formulas", () => {
    const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
    day.entries[0] = { ...day.entries[0], item: "=cmd()" };
    const csv = toCsv(day);
    expect(csv).toContain(`"'=cmd()"`);
    const message = toWhatsApp(day);
    expect(message).toContain("CONTOH");
    expect(message).toContain("bukan laporan keuangan");
    expect(message).toContain("lebih Rp15.000");
  });
});
