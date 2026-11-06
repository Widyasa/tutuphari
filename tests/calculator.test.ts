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
    expect(before.selisih).toBe(-15_000);
    expect(before.penjualanTunai).toBe(120_000);
    expect(before.kasbonBayarTunai).toBe(20_000);
    expect(before.penjualanQris).toBe(0);
    expect(before.verdict).toBe("kurang");

    const beforeText = explainClose(before);
    expect(beforeText).toContain("jual es teh 2 10rb");
    expect(beforeText.toLowerCase()).toContain("belum terjelaskan");

    const asTunai = {
      ...day,
      entries: day.entries.map((entry) =>
        entry.id === "demo-entry-6"
          ? {
              ...entry,
              method: "tunai" as const,
              status: "confirmed" as const,
              needsConfirmation: false,
            }
          : entry,
      ),
    };
    const afterTunai = closeDay(asTunai);
    expect(afterTunai.expectedCash).toBe(265_000);
    expect(afterTunai.penjualanTunai).toBe(130_000);
    expect(afterTunai.selisih).toBe(-25_000);

    const asQris = {
      ...day,
      entries: day.entries.map((entry) =>
        entry.id === "demo-entry-6"
          ? {
              ...entry,
              method: "qris" as const,
              status: "confirmed" as const,
              needsConfirmation: false,
            }
          : entry,
      ),
    };
    const afterQris = closeDay(asQris);
    expect(afterQris.expectedCash).toBe(255_000);
    expect(afterQris.selisih).toBe(-15_000);
    expect(afterQris.penjualanQris).toBe(10_000);
    expect(explainClose(afterQris).toLowerCase()).toContain("belum terjelaskan");
  });
});

describe("kasbon and export", () => {
  it("keeps the design kasbon book at Rp45.000 with opening balances", () => {
    const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
    const book = kasbonBook([day]);
    const made = book.find((row) => row.person === "Pak Made");
    const wayan = book.find((row) => row.person === "Bu Wayan");
    const komang = book.find((row) => row.person === "Bu Komang");
    expect(made?.outstanding).toBe(15_000);
    expect(wayan?.outstanding).toBe(10_000);
    expect(komang?.outstanding).toBe(20_000);
    expect((made?.outstanding ?? 0) + (wayan?.outstanding ?? 0) + (komang?.outstanding ?? 0)).toBe(45_000);
  });

  it("builds WhatsApp text and guards CSV formulas", () => {
    const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
    day.entries[0] = { ...day.entries[0], item: "=cmd()" };
    const csv = toCsv(day);
    expect(csv).toContain(`"'=cmd()"`);
    const message = toWhatsApp(day);
    expect(message).toContain("CONTOH");
    expect(message).toContain("bukan laporan keuangan");
    expect(message).toContain("kurang Rp15.000");
  });

  it("reproduces the design ledger with the existing cash rules", () => {
    const confirmed = { status: "confirmed" as const, needsConfirmation: false };
    const entries = [
      cashEntry({ id: "nasi", type: "penjualan", amount: 120_000, method: "tunai", item: "nasi campur", ...confirmed }),
      cashEntry({ id: "made", type: "kasbon_bayar", amount: 20_000, method: "tunai", counterparty: "Pak Made", ...confirmed }),
      cashEntry({ id: "gas", type: "pengeluaran_usaha", amount: 25_000, method: "tunai", ...confirmed }),
      cashEntry({ id: "prive", type: "ambil_pribadi", amount: 50_000, method: "tunai", ...confirmed }),
      cashEntry({ id: "wayan", type: "kasbon_keluar", amount: 10_000, method: "tunai", counterparty: "Bu Wayan", ...confirmed }),
      cashEntry({
        id: "teh",
        type: "penjualan",
        amount: 10_000,
        method: "tidak_tahu",
        item: "es teh",
        status: "draft",
        needsConfirmation: true,
        sourceText: "jual es teh 2 10rb",
      }),
    ];
    const before = closeDay({ modalAwal: 200_000, entries, countedCash: 240_000, countedQris: null });
    expect(before.penjualanTunai).toBe(120_000);
    expect(before.kasbonBayarTunai).toBe(20_000);
    expect(before.penjualanTunai + before.kasbonBayarTunai).toBe(140_000);
    expect(before.expectedCash).toBe(255_000);
    expect(before.selisih).toBe(-15_000);
    expect(before.penjualanQris).toBe(0);

    const tunai = closeDay({
      modalAwal: 200_000,
      countedCash: 240_000,
      countedQris: null,
      entries: entries.map((entry) =>
        entry.id === "teh" ? { ...entry, method: "tunai" as const, status: "confirmed" as const, needsConfirmation: false } : entry,
      ),
    });
    expect(tunai.expectedCash).toBe(265_000);
    expect(tunai.penjualanTunai).toBe(130_000);
    expect(tunai.selisih).toBe(-25_000);

    const qris = closeDay({
      modalAwal: 200_000,
      countedCash: 240_000,
      countedQris: null,
      entries: entries.map((entry) =>
        entry.id === "teh" ? { ...entry, method: "qris" as const, status: "confirmed" as const, needsConfirmation: false } : entry,
      ),
    });
    expect(qris.expectedCash).toBe(255_000);
    expect(qris.penjualanQris).toBe(10_000);
    expect(qris.selisih).toBe(-15_000);
  });
});
