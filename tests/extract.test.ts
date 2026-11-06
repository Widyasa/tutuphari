import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleExplain, handleExtract } from "@/lib/handlers";
import { resetGeminiCache } from "@/lib/gemini";
import type { Bucket } from "@/lib/rate-limit";
import { createDemoDay } from "@/lib/demo";
import { aiTextIsGrounded, explanationContradictsEntries } from "@/lib/explain";
import { XAI_MODEL_DEFAULT } from "@/lib/xai";
import { extractNote, explainDay } from "@/lib/client-api";

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
  beforeEach(() => {
    resetGeminiCache();
  });
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
        expect(url).toContain("gemini-3-flash-preview:generateContent");
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
    expect(body.provider).toBe("gemini");
    expect(body.model).toBe("gemini-3-flash-preview");
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
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(body.entries[0].amount).toBe(10_000);
    expect(body.warning).toMatch(/tanpa AI/i);
  });

  it("does not report a schema-invalid model reply as AI", async () => {
    const response = await handleExtract(request({ text: "ambil 50rb buat rumah" }), {
      apiKey: "gemini-secret",
      buckets: new Map<string, Bucket>(),
      now: 4_500,
      fetchImpl: async () => geminiOf({ entries: [{ type: "pengeluaran_usaha" }] }),
    });
    const body = await response.json();
    expect(body.parser).toBe("rule");
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(body.warning).toMatch(/tanpa AI|gagal|skema/i);
    expect(body.entries[0]).toMatchObject({ amount: 50_000, parser: "rule" });
  });

  it("uses Grok first and does not send reasoning parameters", async () => {
    const note = "jual nasi campur 3 x 15rb tunai";
    const urls: string[] = [];
    const response = await handleExtract(request({ text: note }), {
      apiKey: "gemini-secret",
      xaiApiKey: "xai-secret",
      buckets: new Map<string, Bucket>(),
      now: 4_600,
      fetchImpl: async (input, init) => {
        const url = String(input);
        urls.push(url);
        expect(url).not.toContain("xai-secret");
        expect(url).not.toContain("gemini-secret");
        const headers = new Headers(init?.headers);
        if (url.includes("api.x.ai")) {
          expect(headers.get("authorization")).toBe("Bearer xai-secret");
          const body = JSON.parse(String(init?.body)) as {
            model?: string;
            temperature?: number;
            reasoning?: unknown;
            reasoning_effort?: unknown;
            response_format?: { type?: string; json_schema?: { strict?: boolean; name?: string } };
          };
          expect(body.model).toBe(XAI_MODEL_DEFAULT);
          expect(body.temperature).toBe(0);
          expect(body.reasoning).toBeUndefined();
          expect(body.reasoning_effort).toBeUndefined();
          expect(Object.keys(body)).not.toContain("reasoning");
          expect(body.response_format?.type).toBe("json_schema");
          expect(body.response_format?.json_schema?.strict).toBe(true);
          expect(body.response_format?.json_schema?.name).toBe("warung_entries");
          return jsonResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
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
                    ],
                  }),
                },
              },
            ],
          });
        }
        throw new Error("gemini should not be called");
      },
    });
    const body = await response.json();
    expect(urls).toEqual(["https://api.x.ai/v1/chat/completions"]);
    expect(body.parser).toBe("ai");
    expect(body.provider).toBe("xai");
    expect(body.model).toBe(XAI_MODEL_DEFAULT);
    expect(body.entries[0].amount).toBe(45_000);
  });

  it("falls through to the next Gemini model after a 429", async () => {
    const note = "ambil 20rb buat rumah";
    const models: string[] = [];
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    const response = await handleExtract(request({ text: note }), {
      apiKey: "gemini-secret",
      models: "gemini-3-flash-preview,gemini-3.1-flash-lite-preview",
      buckets: new Map<string, Bucket>(),
      now: 4_700,
      fetchImpl: async (input) => {
        const url = String(input);
        const model = url.includes("gemini-3-flash-preview")
          ? "gemini-3-flash-preview"
          : "gemini-3.1-flash-lite-preview";
        models.push(model);
        if (model === "gemini-3-flash-preview") return jsonResponse({ error: "quota" }, 429);
        return geminiOf({
          entries: [
            {
              type: "ambil_pribadi",
              amount: 20_000,
              method: "tunai",
              item: null,
              qty: null,
              counterparty: null,
              confidence: 0.9,
              source_text: note,
              needs_confirmation: false,
              question: null,
            },
          ],
        });
      },
    });
    spy.mockRestore();
    const body = await response.json();
    expect(models).toEqual(["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"]);
    expect(body.parser).toBe("ai");
    expect(body.provider).toBe("gemini");
    expect(body.model).toBe("gemini-3.1-flash-lite-preview");
    expect(warnings.join(" ")).toContain("provider=gemini");
    expect(warnings.join(" ")).toContain("status=429");
    expect(warnings.join(" ")).not.toContain("gemini-secret");
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
      const response = await handleExtract(request({ text: `halo ${i}` }, "10.1.1.1"), deps);
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
  beforeEach(() => {
    resetGeminiCache();
  });
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
    expect(goodBody.provider).toBe("gemini");
    expect(goodBody.model).toBe("gemini-3-flash-preview");
    expect(goodBody.explanation).toContain("Rp15.000");

    resetGeminiCache();
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
    expect(badBody.provider).toBeUndefined();
    expect(badBody.model).toBeUndefined();
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
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
  });

  it("rejects an explanation that assigns QRIS to a belum jelas note", async () => {
    const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
    const invented =
      'Selisih lebih Rp15.000. Catatan "es jeruk 15rb" merupakan transaksi QRIS dan tidak masuk laci. Omzet QRIS Rp10.000. Selisih ini belum terjelaskan.';
    expect(
      explanationContradictsEntries(invented, [
        { sourceText: "es jeruk 15rb", item: "es jeruk", method: "tidak_tahu" },
      ]),
    ).toBe(true);
    const response = await handleExplain(
      request(
        {
          warungName: day.warungName,
          modalAwal: day.modalAwal,
          countedCash: day.countedCash,
          countedQris: day.countedQris,
          entries: day.entries,
        },
        "10.2.2.9",
      ),
      {
        apiKey: "test-key",
        buckets: new Map<string, Bucket>(),
        now: 9_000,
        fetchImpl: async () => geminiOf({ explanation: invented }),
      },
    );
    const body = await response.json();
    expect(body.parser).toBe("rule");
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(body.explanation.toLowerCase()).not.toContain("merupakan transaksi qris");
    expect(body.explanation.toLowerCase()).toContain("belum jelas");
    expect(body.warning).toBeTruthy();
  });
});

describe("client timeouts", () => {
  it("uses the rule parser when extract does not settle", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
        });
      });
    const result = await extractNote("jual nasi campur 3 x 15rb tunai", {
      fetchImpl,
      timeoutMs: 20,
    });
    expect(result.parser).toBe("rule");
    expect(result.entries[0]).toMatchObject({ amount: 45_000, method: "tunai" });
    expect(result.warning).toMatch(/tanpa AI/i);
  });

  it("returns no AI summary when explain does not settle", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
        });
      });
    const result = await explainDay({ countedCash: 1 }, { fetchImpl, timeoutMs: 20 });
    expect(result).toBeNull();
  });
});
