import { describe, expect, it, vi } from "vitest";
import { closeDay } from "@/lib/calculator";
import { createDemoDay } from "@/lib/demo";
import {
  assessExplanation,
  closingSentenceView,
  explainClose,
  explainUserPrompt,
  explanationSignature,
  shareInflight,
} from "@/lib/explain";
import type { Entry } from "@/lib/types";

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

function demoPasDay() {
  const demo = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
  const entries = demo.entries.map((item) =>
    item.id === "demo-entry-7"
      ? { ...item, method: "tunai" as const, status: "confirmed" as const, needsConfirmation: false, question: null }
      : item,
  );
  return { ...demo, entries, countedCash: 270_000 };
}

function claimsFor(result: ReturnType<typeof closeDay>, entries: Entry[]) {
  return {
    warmth: "Laci sudah cocok.",
    claims: [
      { kind: "gap" as const, entryId: null, amount: Math.abs(result.selisih ?? 0), sign: result.verdict === "belum_dihitung" ? ("pas" as const) : result.verdict },
      { kind: "qris_not_in_drawer" as const, entryId: null, amount: result.penjualanQris, sign: null },
      ...result.whatIfs.map((item) => ({
        kind: item.method === "tidak_tahu" ? ("unclear_note" as const) : ("unconfirmed_note" as const),
        entryId: item.entryId,
        amount: item.amount,
        sign: null,
      })),
    ],
    entries,
  };
}

describe("balanced drawer explanation", () => {
  it("accepts a zero gap only when the calculator is balanced", () => {
    const day = demoPasDay();
    const result = closeDay(day);
    expect(result.selisih).toBe(0);
    expect(result.verdict).toBe("pas");
    const accepted = assessExplanation({ model: claimsFor(result, day.entries), result, entries: day.entries });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.explanation).toMatch(/laci pas/i);
    expect(accepted.explanation).toContain("Yang menambah laci");
    expect(accepted.explanation).toContain("Tidak ada selisih yang tersisa");
    expect(accepted.explanation).not.toMatch(/kamu salah|kamu lupa|keliru/i);

    const missingGap = assessExplanation({
      model: { warmth: "", claims: [{ kind: "qris_not_in_drawer", entryId: null, amount: result.penjualanQris, sign: null }] },
      result,
      entries: day.entries,
    });
    expect(missingGap.ok).toBe(false);
    if (!missingGap.ok) expect(missingGap.reason).toBe("incomplete");

    const qrisAsShortage = assessExplanation({
      model: {
        warmth: "",
        claims: [
          { kind: "gap", entryId: null, amount: 0, sign: "pas" },
          { kind: "qris_not_in_drawer", entryId: null, amount: result.penjualanQris, sign: "kurang" },
        ],
      },
      result,
      entries: day.entries,
    });
    expect(qrisAsShortage.ok).toBe(false);
    if (!qrisAsShortage.ok) expect(qrisAsShortage.reason).toBe("relation");
  });

  it("tells the model to keep the zero gap and a null QRIS sign", () => {
    const day = demoPasDay();
    const result = closeDay(day);
    const prompt = explainUserPrompt({ warungName: day.warungName, result, entries: day.entries });
    expect(prompt).toContain("Klaim selisih wajib berjumlah 0 dengan tanda pas");
    expect(prompt).toContain("Jangan membuat klaim catatan");
    expect(prompt).toContain(`berjumlah ${result.penjualanQris}`);
    expect(prompt).not.toMatch(/entryId|qris_not_in_drawer/);
  });

  it("states an unknown surplus or shortage without inventing a cause", () => {
    const sale: Entry = {
      id: "sale",
      noteId: "note",
      type: "penjualan",
      amount: 20_000,
      method: "tunai",
      item: "teh",
      qty: null,
      counterparty: null,
      confidence: 1,
      sourceText: "jual teh 20rb tunai",
      needsConfirmation: false,
      question: null,
      parser: "rule",
      status: "confirmed",
    };
    for (const countedCash of [230_000, 210_000]) {
      const result = closeDay({ modalAwal: 200_000, entries: [sale], countedCash, countedQris: null });
      const text = explainClose(result);
      expect(text).toContain("tidak bisa ditentukan");
      expect(text).toMatch(/belum terjelaskan/i);
      expect(text).toContain("Periksa ulang uang kertas dan koin");
      expect(text).toContain("Yang menambah laci");
      expect(text).not.toMatch(/kamu salah|kamu lupa|keliru/i);
      const judged = assessExplanation({ model: claimsFor(result, [sale]), result, entries: [sale] });
      expect(judged.ok).toBe(true);
      if (judged.ok) expect(judged.explanation).toContain("tidak bisa ditentukan");
    }
  });
});

function confirmed(over: Partial<Entry> & Pick<Entry, "id" | "type" | "amount" | "method" | "sourceText">): Entry {
  return {
    noteId: "n",
    item: null,
    qty: null,
    counterparty: null,
    confidence: 1,
    needsConfirmation: false,
    question: null,
    parser: "ai",
    status: "confirmed",
    ...over,
  };
}

describe("kasbon explain responses observed from the provider", () => {
  const kasbonOut = confirmed({
    id: "kasbon-out",
    type: "kasbon_keluar",
    amount: 30_000,
    method: "tunai",
    sourceText: "bu wayan kasbon 30rb tunai",
    counterparty: "bu wayan",
  });
  const sale = confirmed({
    id: "sale-tunai",
    type: "penjualan",
    amount: 50_000,
    method: "tunai",
    sourceText: "jual nasi 50rb tunai",
    item: "nasi",
  });

  it("rejects the captured pas response that marks a confirmed kasbon as unconfirmed", () => {
    const entries = [kasbonOut];
    const result = closeDay({ modalAwal: 200_000, entries, countedCash: 170_000, countedQris: null });
    expect(result.selisih).toBe(0);
    const judged = assessExplanation({
      model: {
        warmth: "selamat istirahat",
        claims: [
          { kind: "gap", entryId: null, amount: 0, sign: "pas" },
          { kind: "unconfirmed_note", entryId: "bu wayan kasbon 30rb tunai", amount: 30_000, sign: null },
        ],
      },
      result,
      entries,
    });
    expect(judged.ok).toBe(false);
    if (!judged.ok) {
      expect(judged.reason).toBe("relation");
      expect(judged.detail).toBe("note_extra");
    }
    const prompt = explainUserPrompt({ warungName: "Warung Uji", result, entries });
    expect(prompt).toContain("Sudah masuk hitungan");
    expect(prompt).not.toContain("id kasbon-out");
  });

  it("rejects the captured surplus and shortage responses that add note claims for confirmed rows", () => {
    const entries = [sale, kasbonOut];
    const surplus = closeDay({ modalAwal: 200_000, entries, countedCash: 250_000, countedQris: null });
    const shortage = closeDay({ modalAwal: 200_000, entries, countedCash: 10_000, countedQris: null });
    expect(surplus.selisih).toBe(30_000);
    expect(shortage.selisih).toBe(-210_000);
    for (const [result, sign, amount] of [
      [surplus, "lebih", 30_000],
      [shortage, "kurang", 210_000],
    ] as const) {
      const judged = assessExplanation({
        model: {
          warmth: sign === "lebih" ? "selisih lebih" : "Maaf ada selisih.",
          claims: [
            { kind: "gap", entryId: null, amount, sign },
            { kind: "unconfirmed_note", entryId: "sale-tunai", amount: 50_000, sign: null },
            { kind: "unconfirmed_note", entryId: "kasbon-out", amount: 30_000, sign: null },
          ],
        },
        result,
        entries,
      });
      expect(judged.ok).toBe(false);
      if (!judged.ok) expect(judged.detail).toBe("note_extra");
      const accepted = assessExplanation({
        model: { warmth: "Perlu dicek.", claims: [{ kind: "gap", entryId: null, amount, sign }] },
        result,
        entries,
      });
      expect(accepted.ok).toBe(true);
      if (accepted.ok) {
        expect(accepted.explanation).toContain("kasbon keluar tunai Rp30.000");
        expect(accepted.explanation).toContain("tidak bisa ditentukan");
      }
    }
  });

  it("still rejects a wrong gap amount or direction on a kasbon day", () => {
    const entries = [kasbonOut];
    const result = closeDay({ modalAwal: 200_000, entries, countedCash: 140_000, countedQris: null });
    expect(result.selisih).toBe(-30_000);
    const wrongAmount = assessExplanation({
      model: { warmth: "", claims: [{ kind: "gap", entryId: null, amount: 10_000, sign: "kurang" }] },
      result,
      entries,
    });
    const wrongSign = assessExplanation({
      model: { warmth: "", claims: [{ kind: "gap", entryId: null, amount: 30_000, sign: "lebih" }] },
      result,
      entries,
    });
    expect(wrongAmount.ok).toBe(false);
    expect(wrongSign.ok).toBe(false);
    if (!wrongAmount.ok) expect(wrongAmount.detail).toBe("gap_amount");
    if (!wrongSign.ok) expect(wrongSign.detail).toBe("gap_sign");
  });
});
