import { parseNotes } from "@/lib/parser";
import {
  isEntryType,
  isMethod,
  type ExtractedEntry,
  type Method,
} from "@/lib/types";

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function asString(value: unknown, max = 240): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function asAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > 1_000_000_000_000) {
    return null;
  }
  return number;
}

function groundAmount(source: string, aiAmount: number | null): number | null {
  const parsed = parseNotes(source)
    .map((entry) => entry.amount)
    .filter((amount): amount is number => amount != null);
  if (aiAmount != null && parsed.includes(aiAmount)) return aiAmount;
  const digits = source.replace(/\D/g, "");
  if (aiAmount != null && digits.includes(String(aiAmount))) return aiAmount;
  if (parsed.length === 1) return parsed[0];
  return null;
}

function unwrapEntries(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  const entries = (payload as { entries?: unknown }).entries;
  return Array.isArray(entries) ? entries : null;
}

/**
 * Keep only AI rows whose source text is actually in the note.
 * Amounts that the note cannot support are replaced or cleared — never invented.
 * Returns null when the payload itself is unusable.
 */
export function sanitizeAiEntries(
  note: string,
  payload: unknown,
): ExtractedEntry[] | null {
  const rawEntries = unwrapEntries(payload);
  if (!rawEntries) return null;
  const haystack = normalize(note);
  const kept: ExtractedEntry[] = [];

  for (const raw of rawEntries) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const source = asString(record.source_text ?? record.sourceText, 500);
    if (!source || !haystack.includes(normalize(source))) continue;

    const typeValue = asString(record.type, 40);
    if (!typeValue || !isEntryType(typeValue)) continue;

    const methodValue = asString(record.method, 20);
    const method: Method =
      methodValue && isMethod(methodValue) ? methodValue : "tidak_tahu";

    const claimed = asAmount(record.amount);
    const amount = groundAmount(source, claimed);
    const amountWasRewritten = claimed !== amount;

    const confidenceRaw = Number(record.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0.5;

    const qtyRaw = Number(record.qty);
    const qty =
      Number.isInteger(qtyRaw) && qtyRaw > 0 && qtyRaw < 10_000 ? qtyRaw : null;

    const needsFlag =
      amount == null ||
      method === "tidak_tahu" ||
      amountWasRewritten ||
      record.needs_confirmation === true ||
      record.needsConfirmation === true;

    const question =
      asString(record.question, 160) ??
      (amount == null
        ? "Nominalnya berapa?"
        : method === "tidak_tahu"
          ? "Ini tunai atau QRIS?"
          : null);

    kept.push({
      type: typeValue,
      amount,
      method,
      item: asString(record.item, 80),
      qty,
      counterparty: asString(record.counterparty, 80),
      confidence: amountWasRewritten ? Math.min(confidence, 0.55) : confidence,
      sourceText: source,
      needsConfirmation: needsFlag,
      question: needsFlag ? question : null,
      parser: "ai",
    });
    if (kept.length >= 40) break;
  }

  return kept;
}
