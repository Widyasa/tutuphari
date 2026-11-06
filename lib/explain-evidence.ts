import { closeDay } from "@/lib/calculator";
import { createDemoDay } from "@/lib/demo";
import {
  assessExplanation,
  explainClose,
  type ExplainClaim,
  whatIfSentences,
} from "@/lib/explain";
import { parseNotes } from "@/lib/parser";
import type { DayRecord, Entry } from "@/lib/types";

export function buildUiExplainDay(): DayRecord {
  const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
  const added = ["jual nasi campur 3 x 15rb tunai", "es teh 2 10rb"].map((text, index) => {
    const parsed = parseNotes(text)[0];
    const entry: Entry = {
      ...parsed,
      id: index === 0 ? "ui-entry-nasi" : "ui-entry-teh",
      noteId: index === 0 ? "ui-note-nasi" : "ui-note-teh",
      status: "draft",
      parser: "ai",
    };
    return entry;
  });
  return { ...day, entries: [...day.entries, ...added] };
}

export function uiExplainPayload(day = buildUiExplainDay()) {
  return {
    warungName: day.warungName,
    modalAwal: day.modalAwal,
    countedCash: day.countedCash,
    countedQris: day.countedQris,
    entries: day.entries,
  };
}

export function validExplainClaims(day: DayRecord): { warmth: string; claims: ExplainClaim[] } {
  const result = closeDay(day);
  return {
    warmth: "Sudah kelihatan mana yang perlu dicek.",
    claims: [
      {
        kind: "gap",
        entryId: null,
        amount: Math.abs(result.selisih ?? 0),
        sign: result.verdict === "belum_dihitung" ? "pas" : result.verdict,
      },
      { kind: "qris_not_in_drawer", entryId: null, amount: result.penjualanQris, sign: null },
      ...result.whatIfs.map((item) => ({
        kind: item.method === "tidak_tahu" ? ("unclear_note" as const) : ("unconfirmed_note" as const),
        entryId: item.entryId,
        amount: item.amount,
        sign: null,
      })),
    ],
  };
}

export type EvidenceRow = {
  name: string;
  input: string;
  output: string;
  pass: boolean;
};

export function explainEvidenceRows(): EvidenceRow[] {
  const day = buildUiExplainDay();
  const result = closeDay(day);
  const rows: EvidenceRow[] = [];

  const accepted = assessExplanation({
    model: validExplainClaims(day),
    result,
    entries: day.entries,
  });
  const lines = whatIfSentences(result);
  rows.push({
    name: "UI payload, claims match the calculator",
    input: "demo plus jual nasi campur 3 x 15rb tunai and es teh 2 10rb, all required claims correct",
    output: accepted.ok ? accepted.explanation : accepted.reason,
    pass:
      accepted.ok &&
      lines.every((line) => accepted.explanation.includes(line)) &&
      accepted.explanation.includes("Selisih lebih Rp15.000"),
  });

  const whatIfPass = lines.length === result.whatIfs.length && new Set(lines).size === lines.length;
  rows.push({
    name: "One what-if per open note",
    input: result.whatIfs.map((item) => `${item.entryId} ${item.sourceText} ${item.method}`).join("; "),
    output: lines.join("\n"),
    pass: whatIfPass,
  });

  const wrongs: { name: string; model: unknown }[] = [
    {
      name: "Rp0 claimed for the whole gap",
      model: {
        warmth: "",
        claims: validExplainClaims(day).claims.map((claim) =>
          claim.kind === "gap" ? { ...claim, amount: 0, sign: "pas" } : claim,
        ),
      },
    },
    {
      name: "Rp45.000 attached to es teh",
      model: {
        warmth: "",
        claims: validExplainClaims(day).claims.map((claim) =>
          claim.entryId === "ui-entry-teh" ? { ...claim, amount: 45_000 } : claim,
        ),
      },
    },
    {
      name: "Gap sign kurang while the drawer is lebih",
      model: {
        warmth: "",
        claims: validExplainClaims(day).claims.map((claim) =>
          claim.kind === "gap" ? { ...claim, sign: "kurang" } : claim,
        ),
      },
    },
  ];
  for (const wrong of wrongs) {
    const judged = assessExplanation({ model: wrong.model, result, entries: day.entries });
    rows.push({
      name: wrong.name,
      input: JSON.stringify(wrong.model),
      output: judged.ok ? judged.explanation : `${judged.reason}\n${explainClose(result)}`,
      pass: !judged.ok && judged.reason === "relation",
    });
  }

  const summary = explainClose(result);
  const nasi = summary.includes('Catatan "jual nasi campur 3 x 15rb tunai" belum dikonfirmasi');
  const jeruk = summary.includes('Catatan "es jeruk 15rb" cara bayarnya belum jelas');
  const mixed =
    summary.includes('Catatan "jual nasi campur 3 x 15rb tunai" cara bayarnya belum jelas') ||
    summary.includes('Catatan "es jeruk 15rb" belum dikonfirmasi');
  rows.push({
    name: "Draft known method vs unknown method",
    input: "ui-entry-nasi tunai draft; es jeruk and es teh 2 10rb method unknown",
    output: summary,
    pass: nasi && jeruk && !mixed,
  });

  return rows;
}

export function explainEvidenceMarkdown(): string {
  const rows = explainEvidenceRows();
  const body = rows
    .map(
      (row) =>
        `## ${row.name}\n\n- Result: ${row.pass ? "pass" : "fail"}\n- Input: ${row.input}\n- Output:\n\n\`\`\`\n${row.output}\n\`\`\``,
    )
    .join("\n\n");
  return `# Explain evidence\n\n${body}\n`;
}
