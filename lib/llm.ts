import {
  cacheGet,
  cacheSet,
  callGemini,
  geminiCacheKey,
  SERVER_GEMINI_BUDGET_MS,
} from "@/lib/gemini";
import { callXai, resolveXaiModel, XaiRequestError } from "@/lib/xai";

export type LlmSuccess = {
  data: unknown;
  provider: "xai" | "gemini";
  model: string;
};

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "TimeoutError" || name === "AbortError";
}

function logFailure(provider: "xai" | "gemini", model: string, status: string): void {
  console.warn(`llm provider=${provider} model=${model} status=${status}`);
}

export async function runStructured(options: {
  geminiApiKey?: string;
  geminiModel?: string;
  geminiModels?: string;
  xaiApiKey?: string;
  xaiModel?: string;
  system: string;
  user: string;
  schema: object;
  schemaName: string;
  accept: (data: unknown) => boolean;
  fetchImpl?: typeof fetch;
  maxOutputTokens?: number;
  now?: number;
  budgetMs?: number;
}): Promise<LlmSuccess> {
  const now = options.now ?? Date.now();
  const budgetMs = options.budgetMs ?? SERVER_GEMINI_BUDGET_MS;
  const started = now;
  const key = geminiCacheKey([options.schemaName, options.system, options.user]);
  const cached = cacheGet(key, now);
  if (cached && options.accept(cached.data)) {
    return { data: cached.data, provider: cached.provider, model: cached.model };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let lastError: unknown;

  if (options.xaiApiKey) {
    const model = resolveXaiModel(options.xaiModel);
    const remaining = budgetMs - (Date.now() - started);
    if (remaining >= 400) {
      try {
        const data = await callXai({
          apiKey: options.xaiApiKey,
          model,
          system: options.system,
          user: options.user,
          schema: options.schema,
          schemaName: options.schemaName,
          fetchImpl,
          timeoutMs: remaining,
        });
        if (!options.accept(data)) {
          logFailure("xai", model, "schema");
          lastError = new Error("schema");
        } else {
          cacheSet(key, "xai", model, data, Date.now());
          return { data, provider: "xai", model };
        }
      } catch (error) {
        const status =
          error instanceof XaiRequestError
            ? String(error.status)
            : isTimeoutError(error)
              ? "timeout"
              : "error";
        logFailure("xai", model, status);
        lastError = error;
      }
    } else {
      logFailure("xai", model, "budget");
    }
  }

  if (options.geminiApiKey) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining >= 400) {
      const result = await callGemini({
        apiKey: options.geminiApiKey,
        model: options.geminiModel,
        models: options.geminiModels,
        system: options.system,
        user: options.user,
        schema: options.schema,
        fetchImpl,
        maxOutputTokens: options.maxOutputTokens,
        now: Date.now(),
        budgetMs: remaining,
        skipCache: true,
        accept: options.accept,
      });
      cacheSet(key, "gemini", result.model, result.data, Date.now());
      return { data: result.data, provider: "gemini", model: result.model };
    }
    logFailure("gemini", options.geminiModel?.trim() || "chain", "budget");
  }

  throw lastError instanceof Error ? lastError : new Error("AI gagal");
}
