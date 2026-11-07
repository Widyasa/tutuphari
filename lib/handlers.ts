import { closeDay } from "@/lib/calculator";
import { assessExplanation, explainClose, explainUserPrompt, matchesExplainSchema } from "@/lib/explain";
import {
  EXPLAIN_SCHEMA,
  EXPLAIN_SYSTEM,
  EXTRACT_SCHEMA,
  EXTRACT_SERVER_BUDGET_MS,
  EXTRACT_SYSTEM,
} from "@/lib/gemini";
import { matchesExtractSchema, sanitizeAiEntries } from "@/lib/ground";
import { runStructured } from "@/lib/llm";
import { parseNotes } from "@/lib/parser";
import { allowRequest, type Bucket } from "@/lib/rate-limit";
import {
  isEntryType,
  isMethod,
  type Entry,
  type EntryStatus,
} from "@/lib/types";

export type HandlerDeps = {
  apiKey?: string;
  model?: string;
  models?: string;
  xaiApiKey?: string;
  xaiModel?: string;
  fetchImpl?: typeof fetch;
  buckets: Map<string, Bucket>;
  now: number;
  budgetMs?: number;
};

const MAX_TEXT = 8_000;

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const raw = forwarded || request.headers.get("x-real-ip") || "local";
  return raw.slice(0, 64) || "local";
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 20_000) {
    throw Object.assign(new Error("too_large"), { status: 413 });
  }
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error("bad_json"), { status: 400 });
  }
}

export async function handleExtract(
  request: Request,
  deps: HandlerDeps,
): Promise<Response> {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    const message = status === 413 ? "Catatan terlalu panjang." : "Body bukan JSON.";
    return Response.json({ error: message }, { status });
  }

  const text =
    body && typeof body === "object" && "text" in body && typeof body.text === "string"
      ? body.text
      : "";
  if (!text.trim()) {
    return Response.json({ error: "Catatan kosong." }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return Response.json(
      { error: "Catatan terlalu panjang (maks 8000 karakter)." },
      { status: 413 },
    );
  }

  const ruleEntries = parseNotes(text);
  if (!allowRequest(deps.buckets, clientIp(request), deps.now)) {
    return Response.json(
      {
        parser: "rule",
        entries: ruleEntries,
        warning: "Terlalu banyak permintaan. Dipakai pembacaan tanpa AI.",
      },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  if (!deps.apiKey && !deps.xaiApiKey) {
    return Response.json({
      parser: "rule",
      entries: ruleEntries,
      warning: "Kunci AI belum dipasang. Dipakai pembacaan tanpa AI.",
    });
  }

  try {
    const result = await runStructured({
      geminiApiKey: deps.apiKey,
      geminiModel: deps.model,
      geminiModels: deps.models,
      xaiApiKey: deps.xaiApiKey,
      xaiModel: deps.xaiModel,
      system: EXTRACT_SYSTEM,
      user: `Catatan:\n<<<\n${text}\n>>>`,
      schema: EXTRACT_SCHEMA,
      schemaName: "warung_entries",
      accept: matchesExtractSchema,
      fetchImpl: deps.fetchImpl,
      budgetMs: deps.budgetMs ?? EXTRACT_SERVER_BUDGET_MS,
    });
    if (!matchesExtractSchema(result.data)) {
      return ruleExtract(ruleEntries, "Jawaban AI tidak sesuai skema. Dipakai pembacaan tanpa AI.");
    }
    const aiEntries = sanitizeAiEntries(text, result.data);
    const ruleHasMoney = ruleEntries.some((entry) => entry.amount != null);
    if (!aiEntries || (aiEntries.length === 0 && ruleHasMoney)) {
      return ruleExtract(ruleEntries, "AI tidak menghasilkan entri yang bisa dicek. Dipakai pembacaan tanpa AI.");
    }
    return Response.json({
      parser: "ai",
      entries: aiEntries,
      provider: result.provider,
      model: result.model,
    });
  } catch {
    return ruleExtract(ruleEntries, "AI sedang gagal. Dipakai pembacaan tanpa AI.");
  }
}

function ruleExtract(entries: ReturnType<typeof parseNotes>, warning: string): Response {
  return Response.json({ parser: "rule", entries, warning });
}

function readEntries(value: unknown): Entry[] | null {
  if (!Array.isArray(value) || value.length > 80) return null;
  const entries: Entry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : "";
    const method = typeof record.method === "string" ? record.method : "";
    const status = record.status === "confirmed" ? "confirmed" : "draft";
    if (!isEntryType(type) || !isMethod(method)) return null;
    const amount =
      record.amount == null
        ? null
        : Number.isInteger(record.amount) &&
            (record.amount as number) >= 0 &&
            (record.amount as number) <= 1_000_000_000_000
          ? (record.amount as number)
          : null;
    entries.push({
      id: typeof record.id === "string" ? record.id.slice(0, 80) : "entry",
      noteId: typeof record.noteId === "string" ? record.noteId.slice(0, 80) : "note",
      type,
      amount,
      method,
      item: typeof record.item === "string" ? record.item.slice(0, 80) : null,
      qty: Number.isInteger(record.qty) ? (record.qty as number) : null,
      counterparty:
        typeof record.counterparty === "string" ? record.counterparty.slice(0, 80) : null,
      confidence: Number.isFinite(record.confidence) ? Number(record.confidence) : 0,
      sourceText: typeof record.sourceText === "string" ? record.sourceText.slice(0, 500) : "",
      needsConfirmation: Boolean(record.needsConfirmation),
      question: typeof record.question === "string" ? record.question.slice(0, 160) : null,
      parser: record.parser === "ai" || record.parser === "demo" ? record.parser : "rule",
      status: status as EntryStatus,
    });
  }
  return entries;
}

export async function handleExplain(
  request: Request,
  deps: HandlerDeps,
): Promise<Response> {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    return Response.json({ error: "Body bukan JSON." }, { status });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Data tutup hari tidak lengkap." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const modalAwal = Number(record.modalAwal);
  const countedCash = Number(record.countedCash);
  const entries = readEntries(record.entries);
  if (!Number.isFinite(modalAwal) || modalAwal < 0 || !Number.isFinite(countedCash) || !entries) {
    return Response.json({ error: "Data tutup hari tidak lengkap." }, { status: 400 });
  }
  const countedQris =
    record.countedQris == null || record.countedQris === ""
      ? null
      : Number(record.countedQris);
  const warungName =
    typeof record.warungName === "string" && record.warungName.trim()
      ? record.warungName.trim().slice(0, 80)
      : "Warung";

  const result = closeDay({
    modalAwal,
    entries,
    countedCash,
    countedQris: countedQris != null && Number.isFinite(countedQris) ? countedQris : null,
  });
  const local = explainClose(result);
  if (!allowRequest(deps.buckets, clientIp(request), deps.now) || (!deps.apiKey && !deps.xaiApiKey)) {
    return Response.json({
      parser: "rule",
      explanation: local,
      warning: deps.apiKey || deps.xaiApiKey
        ? "Terlalu banyak permintaan. Ringkasan tanpa AI."
        : "Kunci AI belum dipasang. Ringkasan tanpa AI.",
    });
  }

  const prompt = explainUserPrompt({ warungName, result, entries });

  try {
    const ai = await runStructured({
      geminiApiKey: deps.apiKey,
      geminiModel: deps.model,
      geminiModels: deps.models,
      xaiApiKey: deps.xaiApiKey,
      xaiModel: deps.xaiModel,
      system: EXPLAIN_SYSTEM,
      user: `Data tutup hari. Jangan menambah apa pun di luar ini.\n${prompt}`,
      schema: EXPLAIN_SCHEMA,
      schemaName: "close_explanation",
      accept: matchesExplainSchema,
      fetchImpl: deps.fetchImpl,
      maxOutputTokens: 512,
    });
    const judged = assessExplanation({ model: ai.data, result, entries });
    if (!judged.ok) return rejectExplain(local, judged.reason, ai, judged.detail);
    return Response.json({
      parser: "ai",
      explanation: judged.explanation,
      provider: ai.provider,
      model: ai.model,
    });
  } catch (error) {
    const reason = error instanceof Error && error.message === "schema" ? "schema" : "provider_error";
    return rejectExplain(local, reason);
  }
}

function rejectExplain(
  explanation: string,
  reason:
    | "schema"
    | "relation"
    | "incomplete"
    | "phrasing"
    | "hypothetical"
    | "provider_error",
  meta?: { provider: string; model: string },
  detail?: string,
): Response {
  console.warn(
    JSON.stringify({
      route: "explain",
      provider: meta?.provider ?? null,
      model: meta?.model ?? null,
      status: "rejected",
      reason,
      detail: detail ?? null,
    }),
  );
  return ruleExplain(explanation);
}

function ruleExplain(explanation: string): Response {
  return Response.json({
    parser: "rule",
    explanation,
    warning: "Kalimat AI ditolak atau gagal. Dipakai ringkasan tanpa AI.",
  });
}
