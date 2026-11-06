import { handleExtract } from "@/lib/handlers";
import type { Bucket } from "@/lib/rate-limit";

const buckets = new Map<string, Bucket>();

export async function POST(request: Request) {
  return handleExtract(request, {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    models: process.env.GEMINI_MODELS,
    xaiApiKey: process.env.XAI_API_KEY,
    xaiModel: process.env.XAI_MODEL,
    buckets,
    now: Date.now(),
  });
}
