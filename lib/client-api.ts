import { parseNotes } from "@/lib/parser";
import type { ExtractedEntry } from "@/lib/types";

export type ExtractResponse = {
  parser: "ai" | "rule";
  entries: ExtractedEntry[];
  warning?: string;
};

export async function extractNote(text: string): Promise<ExtractResponse> {
  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await response.json()) as Partial<ExtractResponse> & { error?: string };
    if (Array.isArray(data.entries)) {
      return {
        parser: data.parser === "ai" ? "ai" : "rule",
        entries: data.entries,
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

export async function explainDay(body: unknown): Promise<{
  parser: "ai" | "rule";
  explanation: string;
} | null> {
  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    const data = (await response.json()) as {
      parser?: string;
      explanation?: string;
    };
    if (typeof data.explanation !== "string") return null;
    return {
      parser: data.parser === "ai" ? "ai" : "rule",
      explanation: data.explanation,
    };
  } catch {
    return null;
  }
}
