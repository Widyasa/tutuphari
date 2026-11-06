import { describe, expect, it } from "vitest";
import { handleExplain, handleExtract } from "@/lib/handlers";
import type { Bucket } from "@/lib/rate-limit";
import { createDemoDay } from "@/lib/demo";
import { aiTextIsGrounded } from "@/lib/explain";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function geminiOf(value: unknown): Response {
  return jsonResponse({
    candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
  });
}

function request(body: unknown, ip = "10.0.0.8"): Request {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("handleExtract", () => {
  it("uses the rule parser when the API key is missing", async () => {
    let called = 0;
    const response = await handleExtract(request({ text: "ambil 50rb buat rumah" }), {
      buckets: new Map<string, Bucket>(),
      now: 1_000,
      fetchImpl: async () => {
        called += 1;
        return geminiOf({});
      },
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(called).toBe(0);
    expect(body.parser).toBe("rule");
    expect(body.entries[0]).toMatchObject({
      type: "ambil_pribadi",
      amount: 50_000,
      parser: "rule",
    });
  });

  it("keeps a mocked Gemini entry and drops an invented one", async () => {
    const note = "jual nasi campur 3 x 15rb tunai";
    let sawKeyInUrl = false;
    const response = await handleExtract(request({ text: note }), {
      apiKey: "test-key",
      buckets: new Map<string, Bucket>(),
      now: 2_000,
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (url.includes("test-key")) sawKeyInUrl = true;
        const headers = new Headers(init?.headers);
        expect(headers.get("x-goog-api-key")).toBe("test-key");
        expect(url).toContain("gemini-2.5-flash:generateContent");
        return geminiOf({
          entries: [
            {
              type: "penjualan",
              amount: 45_000,
              method: "tunai",
              item: "nasi campur",
              qty: 3,
              counterparty: null,
              confidence: 0.9,
              source_text: note,
              needs_confirmation: false,
              question: null,
            },
            {
              type: "lainnya",
              amount: 999_999,
              method: "tunai",
              item: "selisih khayalan",
              qty: null,
              counterparty: null,
              confidence: 0.2,
              source_text: "selisih khayalan 999999",
              needs_confirmation: false,
              question: null,
            },
          ],
        });
      },
    });
    const body = await response.json();
    expect(sawKeyInUrl).toBe(false);
    expect(body.parser).toBe("ai");
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toMatchObject({
      amount: 45_000,
      method: "tunai",
      parser: "ai",
      sourceText: note,
    });
  });

  it("replaces an ungrounded amount with the parsed one", async () => {
    const note = "jual nasi campur 3 x 15rb tunai";
    const response = await handleExtract(request({ text: note }), {
      apiKey: "test-key",
      buckets: new Map<string, Bucket>(),
      now: 3_000,
      fetchImpl: async () =>
        geminiOf({
          entries: [
            {
              type: "penjualan",
              amount: 999_999,
              method: "tunai",
              item: "nasi campur",
              qty: 3,
              counterparty: null,
              confidence: 0.99,
              source_text: note,
              needs_confirmation: false,
              question: null,
            },
          ],
        }),
    });
    const body = await response.json();
    expect(body.entries[0].amount).toBe(45_000);
    expect(body.entries[0].needsConfirmation).toBe(true);
  });

  it("falls back when Gemini fails", async () => {
    const response = await handleExtract(request({ text: "es teh 2 qris 10rb" }), {
      apiKey: "test-key",
      buckets: new Map<string, Bucket>(),
      now: 4_000,
      fetchImpl: async () => jsonResponse({ error: "quota" }, 429),
    });
    const body = await response.json();
    expect(body.parser).toBe("rule");
    expect(body.entries[0].amount).toBe(10_000);
    expect(body.warning).toMatch(/tanpa AI/i);
  });

  it("rate-limits before calling Gemini and still returns entries", async () => {
    const buckets = new Map<string, Bucket>();
    let calls = 0;
    const deps = {
      apiKey: "test-key",
      buckets,
      now: 5_000,
      fetchImpl: async () => {
        calls += 1;
        return geminiOf({ entries: [] });
      },
    };
    for (let i = 0; i < 20; i += 1) {
      const response = await handleExtract(request({ text: "halo saja" }, "10.1.1.1"), deps);
      expect(response.status).toBe(200);
    }
    const blocked = await handleExtract(request({ text: "ambil 50rb buat rumah" }, "10.1.1.1"), deps);
    const body = await blocked.json();
    expect(blocked.status).toBe(429);
    expect(calls).toBe(20);
    expect(body.parser).toBe("rule");
    expect(body.entries[0].amount).toBe(50_000);
  });
});

describe("handleExplain", () => {
  it("accepts a grounded mock and rejects a made-up figure", async () => {
    const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
    const payload = {
      warungName: day.warungName,
      modalAwal: day.modalAwal,
      countedCash: day.countedCash,
      countedQris: day.countedQris,
      entries: day.entries,
    };

    const good = await handleExplain(request(payload, "10.2.2.2"), {
      apiKey: "test-key",
      buckets: new Map<string, Bucket>(),
      now: 6_000,
      fetchImpl: async () =>
        geminiOf({
          explanation:
            "Selisih lebih Rp15.000. Catatan \"es jeruk 15rb\" belum jelas. Kalau tunai, selisih jadi pas Rp0. QRIS Rp10.000 tidak masuk laci. Selisih ini belum terjelaskan.",
        }),
    });
    const goodBody = await good.json();
    expect(goodBody.parser).toBe("ai");
    expect(goodBody.explanation).toContain("Rp15.000");

    const bad = await handleExplain(request(payload, "10.2.2.3"), {
      apiKey: "test-key",
      buckets: new Map<string, Bucket>(),
      now: 7_000,
      fetchImpl: async () =>
        geminiOf({
          explanation: "Sepertinya ada bon tersembunyi Rp999.999 yang menutup laci.",
        }),
    });
    const badBody = await bad.json();
    expect(badBody.parser).toBe("rule");
    expect(badBody.explanation).not.toContain("999");
    expect(badBody.explanation.toLowerCase()).toContain("belum terjelaskan");
    expect(aiTextIsGrounded("Rp999.999", [15_000])).toBe(false);
  });

  it("does not call Gemini without a key", async () => {
    const day = createDemoDay();
    let called = 0;
    const response = await handleExplain(
      request({
        warungName: day.warungName,
        modalAwal: day.modalAwal,
        countedCash: day.countedCash,
        entries: day.entries,
      }),
      {
        buckets: new Map<string, Bucket>(),
        now: 8_000,
        fetchImpl: async () => {
          called += 1;
          return geminiOf({ explanation: "Rp1" });
        },
      },
    );
    const body = await response.json();
    expect(called).toBe(0);
    expect(body.parser).toBe("rule");
    expect(body.explanation.toLowerCase()).toContain("lebih");
  });
});
