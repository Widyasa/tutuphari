import { mkdirSync, writeFileSync } from "node:fs";
import { explainEvidenceMarkdown, uiExplainPayload } from "@/lib/explain-evidence";

const dir = "/opt/cursor/artifacts";
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/explain-evidence.md`, explainEvidenceMarkdown());
writeFileSync(`${dir}/ui-explain-payload.json`, `${JSON.stringify(uiExplainPayload(), null, 2)}\n`);
console.log(`${dir}/explain-evidence.md`);
