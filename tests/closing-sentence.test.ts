import { describe, expect, it, vi } from "vitest";
import { closingSentenceView, explanationSignature, shareInflight } from "@/lib/explain";

const base = {
  modalAwal: 200_000,
  countedQris: null,
  warungName: "Warung Uji",
  expectedCash: 220_000,
  entries: [
    {
      id: "sale",
      status: "confirmed" as const,
      type: "penjualan" as const,
      method: "tunai" as const,
      amount: 20_000,
      needsConfirmation: false,
      sourceText: "jual teh 5rb tunai",
    },
  ],
};

describe("closing sentence", () => {
  it("labels only a grounded AI sentence as AI", () => {
    const local = "Uang yang dihitung Rp230.000. Seharusnya di laci Rp220.000. Selisih lebih Rp10.000.";
    expect(closingSentenceView({ status: "loading", aiText: null, localText: local })).toEqual({
      label: "Lagi minta kalimat AI. Ringkasan di bawah belum dari AI.",
      text: local,
      fromAi: false,
    });
    expect(closingSentenceView({ status: "ai", aiText: "Laci lebih Rp10.000.", localText: local })).toMatchObject({
      label: "Kalimat AI",
      text: "Laci lebih Rp10.000.",
      fromAi: true,
    });
    expect(closingSentenceView({ status: "fallback", aiText: null, localText: local }).fromAi).toBe(false);
    expect(closingSentenceView({ status: "ai", aiText: "  ", localText: local })).toMatchObject({
      fromAi: false,
      text: local,
    });
  });

  it("changes the request signature when the counted cash changes", () => {
    const lebih = explanationSignature({ ...base, countedCash: 230_000, selisih: 10_000 });
    const kurang = explanationSignature({ ...base, countedCash: 210_000, selisih: -10_000 });
    expect(lebih).not.toBe(kurang);
    expect(explanationSignature({ ...base, countedCash: 230_000, selisih: 10_000 })).toBe(lebih);
  });

  it("does not start a second request for the same result", async () => {
    const run = vi.fn(async () => "ok");
    const cache = new Map<string, Promise<string>>();
    const first = shareInflight(cache, "day", run);
    const second = shareInflight(cache, "day", run);
    expect(second).toBe(first);
    await expect(first).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
  });
});
