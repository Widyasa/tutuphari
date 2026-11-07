import type { CloseResult, WhatIf } from "@/lib/calculator";
import { AMOUNT_TOKEN_SOURCE, formatRupiah, parseAmountToken } from "@/lib/rupiah";
import { TYPE_LABEL, type Entry } from "@/lib/types";

function gapPhrase(selisih: number): string {
  if (selisih === 0) return "pas Rp0";
  const arah = selisih < 0 ? "kurang" : "lebih";
  return `${arah} ${formatRupiah(Math.abs(selisih))}`;
}

/**
 * Plain-language closing note. Uses only numbers the calculator already produced.
 * A leftover gap stays "belum terjelaskan".
 */
export function explanationSignature(input: {
  modalAwal: number;
  countedCash: number | null;
  countedQris: number | null;
  warungName: string;
  expectedCash: number;
  selisih: number | null;
  entries: Pick<Entry, "id" | "status" | "type" | "method" | "amount" | "needsConfirmation" | "sourceText">[];
}): string {
  return JSON.stringify({
    modal: input.modalAwal,
    cash: input.countedCash,
    qris: input.countedQris,
    name: input.warungName,
    expected: input.expectedCash,
    selisih: input.selisih,
    entries: input.entries.map((entry) => [
      entry.id,
      entry.status,
      entry.type,
      entry.method,
      entry.amount,
      entry.needsConfirmation,
      entry.sourceText,
    ]),
  });
}

/** One network call per signature, including a second mount of the same result. */
export function shareInflight<T>(cache: Map<string, Promise<T>>, key: string, run: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = run();
  cache.set(key, pending);
  return pending;
}

export function closingSentenceView(input: {
  status: "loading" | "ai" | "fallback";
  aiText: string | null;
  localText: string;
}): { label: string; text: string; fromAi: boolean } {
  if (input.status === "ai" && input.aiText?.trim()) {
    return { label: "Kalimat AI", text: input.aiText, fromAi: true };
  }
  if (input.status === "loading") {
    return {
      label: "Lagi minta kalimat AI. Ringkasan di bawah belum dari AI.",
      text: input.localText,
      fromAi: false,
    };
  }
  return {
    label: "Kalimat AI tidak tersedia. Ringkasan tanpa AI.",
    text: input.localText,
    fromAi: false,
  };
}

export function explainClose(result: CloseResult): string {
  if (result.countedCash == null || result.selisih == null) {
    return "Isi dulu uang yang kamu hitung di laci.";
  }

  const lines = [gapSentence(result), ...drawerFactLines(result)];
  if (result.penjualanQris > 0) lines.push(qrisSentence(result));
  lines.push(...whatIfSentences(result));
  lines.push(...gapCheckLines(result));
  return lines.join("\n");
}

function gapSentence(result: CloseResult): string {
  const figures = `Uang yang dihitung ${formatRupiah(result.countedCash ?? 0)}. Seharusnya di laci ${formatRupiah(result.expectedCash)}. Selisih ${gapPhrase(result.selisih ?? 0)}.`;
  return result.selisih === 0 ? `Laci pas. ${figures}` : figures;
}

function qrisSentence(result: CloseResult): string {
  return `QRIS tidak masuk laci. Omzet QRIS ${formatRupiah(result.penjualanQris)}.`;
}

function namedAmounts(parts: [string, number][]): string {
  return parts
    .filter(([, amount]) => amount > 0)
    .map(([label, amount]) => `${label} ${formatRupiah(amount)}`)
    .join(", ");
}

/** Cash movements the calculator already counted. Zero rows are left out. */
export function drawerFactLines(result: CloseResult): string[] {
  const lines: string[] = [];
  const masuk = namedAmounts([
    ["modal", result.modalAwal],
    ["penjualan tunai", result.penjualanTunai],
    ["kasbon dibayar tunai", result.kasbonBayarTunai],
    ["setor tunai", result.setorTunai],
  ]);
  const keluar = namedAmounts([
    ["pengeluaran tunai", result.pengeluaranTunai],
    ["ambil pribadi tunai", result.ambilPribadiTunai],
    ["kasbon keluar tunai", result.kasbonKeluarTunai],
    ["tarik tunai", result.tarikTunai],
  ]);
  if (masuk) lines.push(`Yang menambah laci: ${masuk}.`);
  if (keluar) lines.push(`Yang mengurangi laci: ${keluar}.`);
  return lines;
}

function gapCheckLines(result: CloseResult): string[] {
  if (result.selisih === 0) {
    return ["Tidak ada selisih yang tersisa untuk dijelaskan dari catatan ini."];
  }
  const lines = [
    result.whatIfs.length > 0
      ? "Angka yang masih tersisa setelah catatan itu belum terjelaskan."
      : "Belum terjelaskan. Tidak ada catatan yang masih menggantung untuk menutup angka ini.",
    "Penyebab selisih ini tidak bisa ditentukan dari catatan yang sudah masuk hitungan.",
    "Periksa ulang uang kertas dan koin di laci.",
  ];
  if (result.whatIfs.length === 0 && (result.selisih ?? 0) > 0) {
    lines.push("Periksa uang masuk yang belum dicatat.");
  }
  if (result.whatIfs.length === 0 && (result.selisih ?? 0) < 0) {
    lines.push("Periksa pengeluaran tunai, ambil pribadi, kasbon, atau tarik yang belum dicatat.");
  }
  return lines;
}

function noteStatusLine(item: WhatIf): string {
  if (item.method === "tidak_tahu") {
    return `Catatan "${item.sourceText}" cara bayarnya belum jelas.`;
  }
  return `Catatan "${item.sourceText}" belum dikonfirmasi, jadi belum masuk hitungan.`;
}

/** One calculator what-if per open note. Notes are never combined. */
export function whatIfSentences(result: CloseResult): string[] {
  return result.whatIfs.map((item) => {
    const effect = `Kalau catatan ini tunai, selisih jadi ${gapPhrase(item.asTunaiSelisih)}. Kalau catatan ini QRIS, selisih jadi ${gapPhrase(item.asQrisSelisih)}.`;
    return `${noteStatusLine(item)} ${effect}`;
  });
}

export function allowedExplainAmounts(
  result: CloseResult,
  entries: { amount: number | null }[] = [],
): number[] {
  const values = [
    result.modalAwal,
    result.penjualanTunai,
    result.penjualanQris,
    result.penjualanTransfer,
    result.penjualanTunai + result.penjualanQris + result.penjualanTransfer,
    result.pengeluaranTunai,
    result.ambilPribadiTunai,
    result.kasbonKeluarTunai,
    result.kasbonBayarTunai,
    result.setorTunai,
    result.tarikTunai,
    result.expectedCash,
    result.countedCash ?? 0,
    result.selisih == null ? 0 : Math.abs(result.selisih),
    result.countedQris ?? 0,
    result.qrisSelisih == null ? 0 : Math.abs(result.qrisSelisih),
    0,
  ];
  for (const entry of entries) {
    if (entry.amount != null) values.push(entry.amount);
  }
  for (const item of result.whatIfs) {
    values.push(item.amount, Math.abs(item.asTunaiSelisih), Math.abs(item.asQrisSelisih));
  }
  return [...new Set(values.map((value) => Math.round(value)))];
}

const METHOD_WORDS: { method: string; pattern: RegExp }[] = [
  { method: "qris", pattern: /\bqris\b/i },
  { method: "tunai", pattern: /\btunai\b|\bcash\b/i },
  { method: "transfer", pattern: /\btransfer\b/i },
];

export type MethodCheckEntry = {
  sourceText: string;
  item: string | null;
  method: string;
};

/**
 * True when a sentence assigns tunai, QRIS, or transfer to a note whose
 * recorded method is different. "Kalau/jika ..." stays allowed.
 */
export function explanationContradictsEntries(
  text: string,
  entries: MethodCheckEntry[],
): boolean {
  const parts = text
    .split(/(?<=[.!?])\s+|\s*(?:,|;)\s+|\s+\bdan\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    const asserted = assertedMethods(part);
    if (asserted.length === 0) continue;
    const referred = entries.filter((entry) => sentenceRefersTo(part, entry));
    if (referred.length === 1) {
      const entry = referred[0];
      if (asserted.some((method) => method !== entry.method)) return true;
      continue;
    }
    for (const entry of referred) {
      const source = entry.sourceText.trim().toLowerCase();
      if (source.length < 4 || !part.toLowerCase().includes(source)) continue;
      if (asserted.some((method) => method !== entry.method)) return true;
    }
  }
  return false;
}

function assertedMethods(sentence: string): string[] {
  const found: string[] = [];
  for (const { method, pattern } of METHOD_WORDS) {
    const match = pattern.exec(sentence);
    if (!match || match.index == null) continue;
    const before = sentence.slice(0, match.index);
    if (/\b(kalau|jika|bila|seandainya)\b/i.test(before)) continue;
    found.push(method);
  }
  return found;
}

function sentenceRefersTo(sentence: string, entry: MethodCheckEntry): boolean {
  const lower = sentence.toLowerCase();
  const source = entry.sourceText.trim().toLowerCase();
  if (source.length >= 4 && lower.includes(source)) return true;
  const item = entry.item?.trim().toLowerCase() ?? "";
  return item.length >= 4 && lower.includes(item);
}

const LEAKED_WORD = /tidak_tahu|whatifs|asqris|\bdraft\b/i;

/** True when a closing sentence echoes code names instead of warung language. */
export function explanationLeaksInternals(text: string): boolean {
  const trimmed = text.trim();
  if (/^kamu\s*,/i.test(trimmed)) return true;
  if (LEAKED_WORD.test(trimmed)) return true;
  if (trimmed.includes("_")) return true;
  if (/[a-z][A-Z]/.test(trimmed)) return true;
  return false;
}

function spokenState(entry: Entry): string {
  if (entry.method === "tidak_tahu") return "cara bayar belum jelas";
  const method = entry.method === "qris" ? "QRIS" : entry.method === "transfer" ? "transfer" : "tunai";
  if (entry.status !== "confirmed") return `cara bayar ${method}, belum dikonfirmasi`;
  return `cara bayar ${method}, sudah dikonfirmasi`;
}

/** Facts for the closing model. No combined hypotheticals and no code names. */
export function explainUserPrompt(input: {
  warungName: string;
  result: CloseResult;
  entries: Entry[];
}): string {
  const { warungName, result, entries } = input;
  const lines = [
    `Nama warung: ${warungName}.`,
    result.countedCash == null || result.selisih == null
      ? "Uang yang dihitung belum diisi."
      : `Uang yang dihitung ${formatRupiah(result.countedCash)}. Seharusnya di laci ${formatRupiah(result.expectedCash)}. Selisih ${gapPhrase(result.selisih)}.`,
  ];
  if (result.selisih === 0) {
    lines.push("Selisih pas. Tetap wajib satu klaim selisih berjumlah 0 dengan tanda pas, tanpa menunjuk catatan. Jangan menghilangkan klaim selisih.");
  }
  if (result.penjualanQris > 0) {
    lines.push(`Omzet QRIS ${formatRupiah(result.penjualanQris)}. QRIS tidak masuk laci.`);
    lines.push(`Klaim omzet QRIS wajib berjumlah ${result.penjualanQris}, tanpa tanda lebih, kurang, atau pas, dan tanpa menunjuk catatan.`);
  }
  lines.push("Catatan hari ini:");
  for (const entry of entries) {
    if (entry.amount == null) continue;
    lines.push(
      `- id ${entry.id}: "${entry.sourceText}": ${TYPE_LABEL[entry.type]}, ${spokenState(entry)}, ${formatRupiah(entry.amount)}.`,
    );
  }
  lines.push("Isi claims saja. Jangan menulis pengandaian dan jangan menggabungkan catatan.");
  return lines.join("\n");
}

export type ClaimKind = "gap" | "qris_not_in_drawer" | "unclear_note" | "unconfirmed_note";

export type ExplainClaim = {
  kind: ClaimKind;
  entryId: string | null;
  amount: number;
  sign: "lebih" | "kurang" | "pas" | null;
};

export type ExplainModelOutput = {
  warmth: string;
  claims: ExplainClaim[];
};

const CLAIM_KINDS = new Set<ClaimKind>([
  "gap",
  "qris_not_in_drawer",
  "unclear_note",
  "unconfirmed_note",
]);

export function matchesExplainSchema(data: unknown): data is ExplainModelOutput {
  if (!data || typeof data !== "object") return false;
  const warmth = (data as { warmth?: unknown }).warmth;
  const claims = (data as { claims?: unknown }).claims;
  if (typeof warmth !== "string" || !Array.isArray(claims)) return false;
  return claims.every(isExplainClaim);
}

function isExplainClaim(value: unknown): value is ExplainClaim {
  if (!value || typeof value !== "object") return false;
  const claim = value as Record<string, unknown>;
  return (
    typeof claim.kind === "string" &&
    CLAIM_KINDS.has(claim.kind as ClaimKind) &&
    (claim.entryId === null || typeof claim.entryId === "string") &&
    typeof claim.amount === "number" &&
    Number.isInteger(claim.amount) &&
    (claim.sign === null || claim.sign === "lebih" || claim.sign === "kurang" || claim.sign === "pas")
  );
}

export type ExplainAssessment =
  | { ok: true; explanation: string }
  | { ok: false; reason: "schema" | "relation" | "incomplete" | "phrasing" | "hypothetical" };

/** Prove every claim. A true number in the wrong place is still a failure. */
export function assessExplanation(input: {
  model: unknown;
  result: CloseResult;
  entries: Entry[];
}): ExplainAssessment {
  if (!matchesExplainSchema(input.model)) return { ok: false, reason: "schema" };
  const relation = claimRelation(input.model.claims, input.result);
  if (relation) return { ok: false, reason: relation };
  const warmth = warmthProblem(input.model.warmth, input.entries);
  if (warmth) return { ok: false, reason: warmth };
  return {
    ok: true,
    explanation: renderAcceptedExplanation(input.model.warmth, input.model.claims, input.result),
  };
}

function claimRelation(
  claims: ExplainClaim[],
  result: CloseResult,
): "relation" | "incomplete" | null {
  if (result.selisih == null || result.countedCash == null || result.verdict === "belum_dihitung") {
    return "incomplete";
  }
  const gaps = claims.filter((claim) => claim.kind === "gap");
  if (gaps.length === 0) return "incomplete";
  if (gaps.length !== 1) return "relation";
  const gap = gaps[0];
  if (gap.entryId !== null || gap.sign !== result.verdict || gap.amount !== Math.abs(result.selisih)) {
    return "relation";
  }

  const qrisClaims = claims.filter((claim) => claim.kind === "qris_not_in_drawer");
  if (result.penjualanQris > 0) {
    if (qrisClaims.length === 0) return "incomplete";
    if (
      qrisClaims.length !== 1 ||
      qrisClaims[0].entryId !== null ||
      qrisClaims[0].amount !== result.penjualanQris ||
      qrisClaims[0].sign !== null
    ) {
      return "relation";
    }
  } else if (
    qrisClaims.some((claim) => claim.amount !== 0 || claim.entryId !== null || claim.sign !== null)
  ) {
    return "relation";
  }

  const expected = new Map(
    result.whatIfs.map((item) => [
      item.entryId,
      item.method === "tidak_tahu" ? "unclear_note" : "unconfirmed_note",
    ] as const),
  );
  const noteClaims = claims.filter(
    (claim) => claim.kind === "unclear_note" || claim.kind === "unconfirmed_note",
  );
  if (noteClaims.length < expected.size) return "incomplete";
  if (noteClaims.length !== expected.size) return "relation";
  for (const claim of noteClaims) {
    if (!claim.entryId) return "relation";
    const kind = expected.get(claim.entryId);
    const item = result.whatIfs.find((candidate) => candidate.entryId === claim.entryId);
    if (!kind || !item || claim.kind !== kind || claim.amount !== item.amount || claim.sign !== null) {
      return "relation";
    }
  }
  return null;
}

function warmthProblem(warmth: string, entries: Entry[]): "hypothetical" | "phrasing" | null {
  const text = warmth.trim();
  if (!text) return null;
  if (/\b(kalau|jika|seandainya)\b/i.test(text)) return "hypothetical";
  if (/\bsemua\b/i.test(text) && /\b(tunai|qris|transfer|cash)\b/i.test(text)) return "hypothetical";
  if (/\d/.test(text) || /\b(tunai|qris|transfer|cash)\b/i.test(text)) return "phrasing";
  if (explanationLeaksInternals(text)) return "phrasing";
  const lower = text.toLowerCase();
  for (const entry of entries) {
    const source = entry.sourceText.trim().toLowerCase();
    if (source.length >= 4 && lower.includes(source)) return "phrasing";
    const item = entry.item?.trim().toLowerCase() ?? "";
    if (item.length >= 4 && lower.includes(item)) return "phrasing";
  }
  return null;
}

export function renderAcceptedExplanation(
  warmth: string,
  claims: ExplainClaim[],
  result: CloseResult,
): string {
  const lines: string[] = [];
  if (warmth.trim()) lines.push(warmth.trim());
  if (claims.some((claim) => claim.kind === "gap")) {
    lines.push(gapSentence(result), ...drawerFactLines(result), ...gapCheckLines(result));
  }
  if (claims.some((claim) => claim.kind === "qris_not_in_drawer") && result.penjualanQris > 0) {
    lines.push(qrisSentence(result));
  }
  lines.push(...whatIfSentences(result));
  return lines.join("\n");
}

/** Reject an AI paragraph that cites a rupiah figure we did not compute. */
export function aiTextIsGrounded(text: string, allowed: number[]): boolean {
  const found = amountsMentioned(text);
  if (found.length === 0) return false;
  return found.every((amount) => allowed.includes(amount));
}

function amountsMentioned(text: string): number[] {
  const pattern = new RegExp(AMOUNT_TOKEN_SOURCE, "gi");
  const found: number[] = [];
  for (const match of text.matchAll(pattern)) {
    const amount = parseAmountToken(match[0]);
    if (amount != null) found.push(amount);
  }
  return found;
}
