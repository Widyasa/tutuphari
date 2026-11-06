import { parseNotes } from "@/lib/parser";
import type { ExtractedEntry } from "@/lib/types";

export const CLIENT_FETCH_TIMEOUT_MS = 9_000;

export type ExtractResponse = {
  parser: "ai" | "rule";
  entries: ExtractedEntry[];
  warning?: string;
};

type ClientOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function extractNote(text: string, options: ClientOptions = {}): Promise<ExtractResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(options.timeoutMs ?? CLIENT_FETCH_TIMEOUT_MS),
    });
    const data = (await response.json()) as Partial<ExtractResponse> & {
      error?: string;
      model?: unknown;
    };
    if (Array.isArray(data.entries)) {
      const realAi = data.parser === "ai" && typeof data.model === "string" && data.model.length > 0;
      return {
        parser: realAi ? "ai" : "rule",
        entries: realAi
          ? data.entries
          : data.entries.map((entry) => ({ ...entry, parser: "rule" as const })),
        warning: data.warning,
      };
    }
  } catch {
    // The phone may be offline. The same parser runs here.
  }
  return {
    parser: "rule",
    entries: parseNotes(text),
    warning: "Tidak tersambung. Dipakai pembacaan tanpa AI.",
  };
}

export async function explainDay(
  body: unknown,
  options: ClientOptions = {},
): Promise<{
  parser: "ai" | "rule";
  explanation: string;
} | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? CLIENT_FETCH_TIMEOUT_MS),
    });
    const data = (await response.json()) as {
      parser?: string;
      explanation?: string;
      model?: unknown;
    };
    if (typeof data.explanation !== "string") return null;
    const realAi = data.parser === "ai" && typeof data.model === "string" && data.model.length > 0;
    return {
      parser: realAi ? "ai" : "rule",
      explanation: data.explanation,
    };
  } catch {
    return null;
  }
}
