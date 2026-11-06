import { stripJsonFence } from "@/lib/gemini";

/** Used when XAI_API_KEY is set and XAI_MODEL is empty. No reasoning parameters are sent. */
export const XAI_MODEL_DEFAULT = "grok-4.20-0309-non-reasoning";

export function resolveXaiModel(model?: string): string {
  const trimmed = model?.trim();
  return trimmed || XAI_MODEL_DEFAULT;
}

export class XaiRequestError extends Error {
  status: number;

  constructor(status: number) {
    super(`xAI ${status}`);
    this.status = status;
  }
}

export async function callXai(options: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schema: object;
  schemaName: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<unknown> {
  const response = await options.fetchImpl("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          schema: options.schema,
          strict: true,
        },
      },
    }),
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  if (!response.ok) {
    await response.text();
    throw new XaiRequestError(response.status);
  }

  const payload: unknown = await response.json();
  const content = readXaiContent(payload);
  if (!content) throw new Error("xAI kosong");
  return JSON.parse(stripJsonFence(content)) as unknown;
}

function readXaiContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const content = (choices[0] as { message?: { content?: unknown } }).message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}
