import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleExplain, handleExtract } from "@/lib/handlers";
import { resetGeminiCache } from "@/lib/gemini";
import type { Bucket } from "@/lib/rate-limit";
import { createDemoDay } from "@/lib/demo";
import { buildUiExplainDay } from "@/lib/explain-evidence";
import { closeDay } from "@/lib/calculator";
import {
  aiTextIsGrounded,
  allowedExplainAmounts,
  explainClose,
  explainUserPrompt,
  explanationContradictsEntries,
  explanationLeaksInternals,
  whatIfSentences,
} from "@/lib/explain";
import { XAI_MODEL_DEFAULT } from "@/lib/xai";
import { CLIENT_FETCH_TIMEOUT_MS, extractNote, explainDay } from "@/lib/client-api";

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
        geminiOf(validClaims(day)),
    });
    const goodBody = await good.json();
    expect(goodBody.parser).toBe("ai");
    expect(goodBody.provider).toBe("gemini");
    expect(goodBody.model).toBe("gemini-3-flash-preview");
    expect(goodBody.explanation).toContain("Selisih lebih Rp15.000");
    expect(goodBody.explanation).toContain('Catatan "es jeruk 15rb" cara bayarnya belum jelas.');
    expect(goodBody.explanation).toContain("Kalau catatan ini tunai, selisih jadi pas Rp0.");

    resetGeminiCache();
    const bad = await handleExplain(request(payload, "10.2.2.3"), {
      apiKey: "test-key",
      buckets: new Map<string, Bucket>(),
      now: 7_000,
      fetchImpl: async () =>
        geminiOf({
          warmth: "Sudah kelihatan mana yang perlu dicek.",
          claims: [{ kind: "gap", entryId: null, amount: 999_000, sign: "lebih" }],
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

  it("falls back when the closing sentence leaks internal field names", async () => {
    const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
    const leaked =
      "Kamu, selisih laci lebih Rp15.000. Entri es jeruk 15rb dengan method tidak_tahu dan status draft wajib disebut belum jelas, sehingga asQrisSelisih Rp15.000 dari whatIfs belum terjelaskan.";
    expect(explanationLeaksInternals(leaked)).toBe(true);
    const prompt = explainUserPrompt({
      warungName: day.warungName,
      result: closeDay(day),
      entries: day.entries,
    });
    expect(explanationLeaksInternals(prompt)).toBe(false);
    expect(prompt).toContain("cara bayar belum jelas");
    expect(prompt.toLowerCase()).not.toContain("kalau");
    const response = await handleExplain(
      request(
        {
          warungName: day.warungName,
          modalAwal: day.modalAwal,
          countedCash: day.countedCash,
          countedQris: day.countedQris,
          entries: day.entries,
        },
        "10.2.2.10",
      ),
      {
        apiKey: "test-key",
        buckets: new Map<string, Bucket>(),
        now: 9_100,
        fetchImpl: async () => geminiOf({ explanation: leaked }),
      },
    );
    const body = await response.json();
    expect(body.parser).toBe("rule");
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(explanationLeaksInternals(body.explanation)).toBe(false);
    expect(body.explanation.toLowerCase()).toContain("belum jelas");
  });
});

function uiReproDay() {
  return buildUiExplainDay();
}

function uiExplainBody(day: ReturnType<typeof uiReproDay>) {
  return {
    warungName: day.warungName,
    modalAwal: day.modalAwal,
    countedCash: day.countedCash,
    countedQris: day.countedQris,
    entries: day.entries,
  };
}

function validClaims(day: ReturnType<typeof createDemoDay>) {
  const result = closeDay(day);
  return {
    warmth: "Sudah kelihatan mana yang perlu dicek.",
    claims: [
      { kind: "gap", entryId: null, amount: Math.abs(result.selisih ?? 0), sign: result.verdict },
      { kind: "qris_not_in_drawer", entryId: null, amount: result.penjualanQris, sign: null },
      ...result.whatIfs.map((item) => ({
        kind: item.method === "tidak_tahu" ? "unclear_note" : "unconfirmed_note",
        entryId: item.entryId,
        amount: item.amount,
        sign: null,
      })),
    ],
  };
}

describe("explain validators for the live UI payload", () => {
  beforeEach(() => {
    resetGeminiCache();
  });

  it("accepts a realistic closing sentence for the demo plus two added notes", async () => {
    const day = uiReproDay();
    const result = closeDay(day);
    const allowed = allowedExplainAmounts(result, day.entries);
    expect(allowed).toContain(45_000);
    expect(allowed).toContain(10_000);
    expect(allowed).toContain(result.penjualanTunai + result.penjualanQris);
    expect(aiTextIsGrounded("Nasi campur tambahan 45 ribu.", allowed)).toBe(true);
    expect(aiTextIsGrounded("Selisihnya ada, tanpa angka.", allowed)).toBe(false);
    const response = await handleExplain(request(uiExplainBody(day), "10.4.0.1"), {
      apiKey: "test-key",
      buckets: new Map<string, Bucket>(),
      now: 11_000,
      fetchImpl: async () => geminiOf(validClaims(day)),
    });
    const body = await response.json();
    expect(body.parser).toBe("ai");
    expect(body.provider).toBe("gemini");
    expect(body.model).toBe("gemini-3-flash-preview");
    const lines = whatIfSentences(result);
    expect(lines).toHaveLength(result.whatIfs.length);
    for (const line of lines) expect(body.explanation).toContain(line);
    const nasi = result.whatIfs.find((item) => item.entryId === "ui-entry-nasi");
    expect(nasi?.asTunaiSelisih).not.toBe(0);
    expect(body.explanation).toContain("Selisih lebih Rp15.000");
    expect(body.explanation).not.toMatch(/semua tunai/i);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      "/opt/cursor/artifacts/ui-explain-payload.json",
      `${JSON.stringify(uiExplainBody(day), null, 2)}\n`,
    );
  });

  it("rejects an explain reply that cites an amount nobody recorded", async () => {
    const day = uiReproDay();
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    const response = await handleExplain(request(uiExplainBody(day), "10.4.0.2"), {
      apiKey: "test-key",
      buckets: new Map<string, Bucket>(),
      now: 11_100,
      fetchImpl: async () =>
        geminiOf({
          warmth: "",
          claims: [{ kind: "gap", entryId: null, amount: 99_000, sign: "lebih" }],
        }),
    });
    spy.mockRestore();
    const body = await response.json();
    expect(body.parser).toBe("rule");
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(body.warning).toMatch(/tanpa AI/i);
    expect(warnings.join(" ")).toContain('"reason":"relation"');
  });

  it("rejects an explain reply that is not the schema", async () => {
    const day = uiReproDay();
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    const response = await handleExplain(request(uiExplainBody(day), "10.4.0.3"), {
      apiKey: "test-key",
      models: "gemini-3-flash-preview",
      buckets: new Map<string, Bucket>(),
      now: 11_200,
      fetchImpl: async () => geminiOf({ nope: true }),
    });
    spy.mockRestore();
    const body = await response.json();
    expect(body.parser).toBe("rule");
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(warnings.join(" ")).toContain('"reason":"schema"');
  });

  it("reports rule when the explain provider errors", async () => {
    const day = uiReproDay();
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    const response = await handleExplain(request(uiExplainBody(day), "10.4.0.4"), {
      apiKey: "gemini-secret",
      models: "gemini-3-flash-preview",
      buckets: new Map<string, Bucket>(),
      now: 11_300,
      fetchImpl: async () => jsonResponse({ error: "unavailable" }, 503),
    });
    spy.mockRestore();
    const body = await response.json();
    expect(body.parser).toBe("rule");
    expect(body.provider).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(body.warning).toMatch(/tanpa AI/i);
    expect(warnings.join(" ")).toContain('"reason":"provider_error"');
    expect(warnings.join(" ")).not.toContain("gemini-secret");
  });
});

describe("structured closing claims", () => {
  it("rejects a combined semua tunai claim that uses a valid Rp0", async () => {
    const day = uiReproDay();
    const warnings: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    const response = await handleExplain(request(uiExplainBody(day), "10.5.0.1"), {
      apiKey: "test-key",
      models: "gemini-3-flash-preview",
      buckets: new Map<string, Bucket>(),
      now: 12_000,
      fetchImpl: async () =>
        geminiOf({
          ...validClaims(day),
          warmth: "Kalau semua tunai selisihnya pas.",
        }),
    });
    spy.mockRestore();
    const body = await response.json();
    expect(body.parser).toBe("rule");
    expect(body.provider).toBeUndefined();
    expect(warnings.join(" ")).toContain('"reason":"hypothetical"');
    expect(body.explanation).toContain('Catatan "es jeruk 15rb" cara bayarnya belum jelas.');
    expect(body.explanation).not.toMatch(/semua tunai/i);
  });

  it("rejects Rp0 as the whole gap, 45000 on es teh, and the wrong gap sign", async () => {
    const day = uiReproDay();
    const teh = day.entries.find((entry) => entry.id === "ui-entry-teh");
    const cases = [
      { kind: "gap", entryId: null, amount: 0, sign: "pas" },
      { kind: "unclear_note", entryId: teh?.id, amount: 45_000, sign: null },
      { kind: "gap", entryId: null, amount: 15_000, sign: "kurang" },
    ];
    for (const [index, badClaim] of cases.entries()) {
      resetGeminiCache();
      const warnings: string[] = [];
      const spy = vi.spyOn(console, "warn").mockImplementation((message) => {
        warnings.push(String(message));
      });
      const claims = validClaims(day).claims.map((claim) =>
        claim.kind === badClaim.kind && claim.entryId === badClaim.entryId ? badClaim : claim,
      );
      const response = await handleExplain(request(uiExplainBody(day), `10.5.1.${index}`), {
        apiKey: "test-key",
        models: "gemini-3-flash-preview",
        buckets: new Map<string, Bucket>(),
        now: 13_000 + index,
        fetchImpl: async () => geminiOf({ warmth: "Sudah kelihatan mana yang perlu dicek.", claims }),
      });
      spy.mockRestore();
      const body = await response.json();
      expect(body.parser).toBe("rule");
      expect(body.provider).toBeUndefined();
      expect(body.model).toBeUndefined();
      expect(warnings.join(" ")).toContain('"reason":"relation"');
      expect(body.explanation).toContain("belum terjelaskan");
    }
  });

  it("appends one calculator what-if per open note", () => {
    const day = uiReproDay();
    const result = closeDay(day);
    const lines = whatIfSentences(result);
    expect(lines).toHaveLength(result.whatIfs.length);
    expect(new Set(lines).size).toBe(lines.length);
    for (const item of result.whatIfs) {
      const line = lines.find((candidate) => candidate.includes(`"${item.sourceText}"`));
      expect(line).toBeTruthy();
      expect(line).toContain(`selisih jadi ${item.asTunaiSelisih === 0 ? "pas Rp0" : item.asTunaiSelisih < 0 ? "kurang" : "lebih"}`);
    }
    const jeruk = lines.find((line) => line.includes("es jeruk 15rb"));
    const nasi = lines.find((line) => line.includes("jual nasi campur 3 x 15rb tunai"));
    expect(jeruk).toContain("pas Rp0");
    expect(nasi).not.toContain("pas Rp0");
  });

  it("keeps belum dikonfirmasi distinct from cara bayar belum jelas", () => {
    const day = uiReproDay();
    const result = closeDay(day);
    const summary = explainClose(result);
    const prompt = explainUserPrompt({ warungName: day.warungName, result, entries: day.entries });
    const nasi = 'Catatan "jual nasi campur 3 x 15rb tunai" belum dikonfirmasi';
    const jeruk = 'Catatan "es jeruk 15rb" cara bayarnya belum jelas';
    const teh = 'Catatan "es teh 2 10rb" cara bayarnya belum jelas';
    expect(summary).toContain(nasi);
    expect(summary).toContain(jeruk);
    expect(summary).toContain(teh);
    expect(summary).not.toContain('Catatan "jual nasi campur 3 x 15rb tunai" cara bayarnya belum jelas');
    expect(summary).not.toContain('Catatan "es jeruk 15rb" belum dikonfirmasi');
    expect(summary).not.toContain('Catatan "es teh 2 10rb" belum dikonfirmasi');
    expect(prompt).toContain("belum dikonfirmasi");
    expect(prompt).toContain("cara bayar belum jelas");
    expect(prompt.toLowerCase()).not.toContain("kalau");
  });
});

describe("client timeouts", () => {
  it("aborts a fetch that never resolves after about 9s and uses the local parser", async () => {
    const started = Date.now();
    let abortedAt = 0;
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        init?.signal?.addEventListener("abort", () => {
          abortedAt = Date.now();
          reject(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
        });
      });
    const result = await extractNote("jual nasi campur 3 x 15rb tunai", { fetchImpl });
    const elapsed = abortedAt - started;
    expect(CLIENT_FETCH_TIMEOUT_MS).toBe(9_000);
    expect(elapsed).toBeGreaterThanOrEqual(8_500);
    expect(elapsed).toBeLessThan(11_000);
    expect(result.parser).toBe("rule");
    expect(result.entries[0]).toMatchObject({ amount: 45_000, method: "tunai", parser: "rule" });
    expect(result.warning).toMatch(/tanpa AI/i);
  }, 15_000);

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
