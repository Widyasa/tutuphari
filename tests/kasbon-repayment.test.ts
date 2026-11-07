import { describe, expect, it } from "vitest";
import { createDay } from "@/lib/day";
import { assessRepayment } from "@/lib/kasbon";
import type { Entry } from "@/lib/types";

function debt(person: string, amount: number): Entry {
  return {
    id: `${person}-${amount}`,
    noteId: "n",
    type: "kasbon_keluar",
    amount,
    method: "tunai",
    item: null,
    qty: null,
    counterparty: person,
    confidence: 1,
    sourceText: `kasbon ${person} ${amount}`,
    needsConfirmation: false,
    question: null,
    parser: "rule",
    status: "confirmed",
  };
}

describe("assessRepayment", () => {
  it("allows a partial payment and the exact remaining balance, and rejects the rest", () => {
    const day = createDay({
      warungName: "QA-TEST-R3b",
      modalAwal: 200_000,
      now: new Date("2026-11-07T03:00:00Z"),
    });
    day.entries = [debt("Bu Qatest", 30_000)];
    day.priorKasbon = [{ person: "Pak Made", amount: 20_000, note: "utang lama" }];

    const partial = assessRepayment({ days: [day], person: "bu qatest", amount: 10_000 });
    expect(partial).toEqual({
      ok: true,
      person: "bu qatest",
      amount: 10_000,
      outstanding: 30_000,
      remainingAfter: 20_000,
    });

    const rest = assessRepayment({ days: [day], person: "Bu Qatest", amount: 20_000 });
    expect(rest.ok).toBe(true);
    if (rest.ok) expect(rest.remainingAfter).toBe(10_000);

    const exact = assessRepayment({ days: [day], person: "Bu Qatest", amount: 30_000 });
    expect(exact.ok).toBe(true);
    if (exact.ok) expect(exact.remainingAfter).toBe(0);

    const tooMuch = assessRepayment({ days: [day], person: "Bu Qatest", amount: 35_000 });
    expect(tooMuch).toMatchObject({
      ok: false,
      reason: "exceeds_remaining",
      outstanding: 30_000,
      message: "Pembayaran Rp35.000 melebihi sisa utang Rp30.000. Pembayaran tidak dicatat.",
    });

    day.entries = [
      ...day.entries,
      { ...debt("Bu Qatest", 10_000), id: "pay-10", type: "kasbon_bayar" },
      { ...debt("Bu Qatest", 20_000), id: "pay-20", type: "kasbon_bayar" },
    ];
    const afterFull = assessRepayment({ days: [day], person: "Bu Qatest", amount: 5_000 });
    expect(afterFull).toMatchObject({
      ok: false,
      reason: "no_active_debt",
      outstanding: 0,
      message: "Bu Qatest tidak punya utang aktif. Pembayaran tidak dicatat.",
    });

    const unmatched = assessRepayment({
      days: [day],
      person: "QA-TEST-R3b-TanpaUtang",
      amount: 7_000,
    });
    expect(unmatched).toMatchObject({
      ok: false,
      reason: "no_active_debt",
      outstanding: 0,
      message: "QA-TEST-R3b-TanpaUtang tidak punya utang aktif. Pembayaran tidak dicatat.",
    });

    const made = assessRepayment({ days: [day], person: "Made", amount: 20_000 });
    expect(made).toMatchObject({ ok: false, reason: "no_active_debt" });
    const pakMade = assessRepayment({ days: [day], person: "Pak Made", amount: 20_000 });
    expect(pakMade.ok).toBe(true);
  });
});
