import { AMOUNT_TOKEN_SOURCE, parseAmountToken } from "@/lib/rupiah";
import type { EntryType, ExtractedEntry, Method } from "@/lib/types";

const SALE_WORD =
  /\b(jual|terjual|laku|porsi|gelas|nasi|kopi|teh|es|gorengan|makan|jus|bakso|mie|soto|ayam)\b/i;

type MoneyHit = {
  amount: number;
  qty: number | null;
  start: number;
  end: number;
};

export function parseNotes(text: string): ExtractedEntry[] {
  const lines = text
    .split(/\n+|;\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: ExtractedEntry[] = [];
  for (const line of lines) {
    entries.push(...parseLine(line));
    if (entries.length >= 40) break;
  }
  return entries.slice(0, 40);
}

function parseLine(line: string): ExtractedEntry[] {
  const hits = findMoney(line);
  if (hits.length === 0) {
    if (!hasSignal(line)) return [];
    return [buildEntry(line, null, null)];
  }

  const segments = hits.map((hit, index) => {
    const start =
      index === 0 ? 0 : Math.floor((hits[index - 1].end + hit.start) / 2);
    const end =
      index === hits.length - 1
        ? line.length
        : Math.floor((hit.end + hits[index + 1].start) / 2);
    return { hit, text: line.slice(start, end).trim() };
  });

  const built = segments.map((segment) =>
    buildEntry(segment.text || line, segment.hit.amount, segment.hit.qty),
  );

  const explicit = built
    .map((entry, index) => ({ entry, text: segments[index]?.text ?? line }))
    .filter(({ text }) => detectMethod(text).explicit);

  const only = explicit.length === 1 ? explicit[0] : null;
  if (only && built.length > 1) {
    for (const entry of built) {
      if (entry.method === "tidak_tahu" && entry.type === "penjualan") {
        entry.method = only.entry.method;
        entry.needsConfirmation = false;
        entry.question = null;
        entry.confidence = Math.max(entry.confidence, 0.8);
      }
    }
  }

  return built;
}

function findMoney(line: string): MoneyHit[] {
  const hits: MoneyHit[] = [];
  const flags = new RegExp(AMOUNT_TOKEN_SOURCE, "gi");
  for (const match of line.matchAll(flags)) {
    const raw = match[0];
    const unit = parseAmountToken(raw);
    if (unit == null || match.index == null) continue;
    const before = line.slice(0, match.index);
    const multiplied = before.match(/(\d+)\s*x\s*$/i);
    const equals = before.match(/(\d+)\s*=\s*$/i);
    const loose = before.match(
      /(?:^|\s)(\d{1,2})\s*(?:gelas|porsi|pcs|bungkus|cup|pax)?\s*(?:qris|qr|tunai|cash|kontan|transfer|tf)?\s*$/i,
    );

    let amount = unit;
    let qty: number | null = null;
    if (multiplied) {
      qty = Number(multiplied[1]);
      amount = unit * qty;
    } else if (equals) {
      qty = Number(equals[1]);
    } else if (loose) {
      qty = Number(loose[1]);
    }

    if (amount <= 0 || amount > 1_000_000_000_000) continue;
    hits.push({
      amount,
      qty,
      start: match.index,
      end: match.index + raw.length,
    });
  }
  return hits;
}

function hasSignal(line: string): boolean {
  return /\b(jual|kasbon|bon|hutang|ambil|bayar|beli|setor|tarik|qris|tunai|cash)\b/i.test(
    line,
  );
}

function buildEntry(
  text: string,
  amount: number | null,
  qty: number | null,
): ExtractedEntry {
  const typeHit = detectType(text);
  const methodHit = detectMethod(text);
  let type: EntryType = typeHit.type;
  let method: Method = methodHit.method;
  let explicitType = typeHit.explicit;

  if (!explicitType && amount != null && SALE_WORD.test(text)) {
    type = "penjualan";
    explicitType = true;
  }

  if (!methodHit.explicit && isDrawerMovement(type) && explicitType) {
    method = "tunai";
  }

  const counterparty = detectPerson(text);
  const item = extractItem(text, counterparty);
  const amountMissing = amount == null;
  const methodUnknown = method === "tidak_tahu";
  const typeUnknown = type === "lainnya" || !explicitType;

  let question: string | null = null;
  if (amountMissing) question = "Nominalnya berapa?";
  else if (methodUnknown && type === "penjualan") question = "Ini tunai atau QRIS?";
  else if (typeUnknown) question = "Ini penjualan, pengeluaran, atau ambil pribadi?";

  let confidence = 0.4;
  if (amountMissing) confidence = 0.3;
  else if (explicitType && methodHit.explicit) confidence = 0.92;
  else if (explicitType && method === "tunai") confidence = 0.8;
  else if (explicitType && methodUnknown) confidence = 0.48;

  const needsConfirmation = amountMissing || methodUnknown || typeUnknown;

  return {
    type: explicitType ? type : "lainnya",
    amount,
    method,
    item,
    qty,
    counterparty,
    confidence,
    sourceText: text.trim(),
    needsConfirmation,
    question: needsConfirmation ? question : null,
    parser: "rule",
  };
}

function isDrawerMovement(type: EntryType): boolean {
  return (
    type === "pengeluaran_usaha" ||
    type === "ambil_pribadi" ||
    type === "kasbon_keluar" ||
    type === "kasbon_bayar" ||
    type === "setor" ||
    type === "tarik"
  );
}

function detectType(text: string): { type: EntryType; explicit: boolean } {
  const t = text.toLowerCase();
  if (
    /\b(bayar|lunas|pelunasan)\b[\s\S]{0,40}\b(kasbon|bon|hutang)\b|\b(kasbon|hutang|bon)\b[\s\S]{0,30}\b(dibayar|lunas|dilunasi)\b/.test(
      t,
    )
  ) {
    return { type: "kasbon_bayar", explicit: true };
  }
  if (/\bkasbon\b|\bbon\b|\bhutang\b/.test(t)) {
    return { type: "kasbon_keluar", explicit: true };
  }
  if (/\bambil\b|\bbuat rumah\b|\bkeperluan rumah\b|\buang rumah\b|\bpribadi\b/.test(t)) {
    return { type: "ambil_pribadi", explicit: true };
  }
  if (/\bsetor modal\b|\btambah modal\b|\bmodal tambahan\b/.test(t)) {
    return { type: "setor", explicit: true };
  }
  if (/\btarik\b|\bke bank\b|\bsetor ke bank\b|\bsetoran\b/.test(t)) {
    return { type: "tarik", explicit: true };
  }
  if (
    /\bbayar\b|\bbeli\b|\bbelanja\b|\bgas\b|\belpiji\b|\blistrik\b|\btoken\b|\bbumbu\b|\bgalon\b|\bkulakan\b/.test(
      t,
    )
  ) {
    return { type: "pengeluaran_usaha", explicit: true };
  }
  if (SALE_WORD.test(t)) return { type: "penjualan", explicit: true };
  return { type: "lainnya", explicit: false };
}

function detectMethod(text: string): { method: Method; explicit: boolean } {
  const t = text.toLowerCase();
  if (/\bqris\b|\bqr\b|\bgopay\b|\bovo\b|\bdana\b|\bshopeepay\b|\bspay\b/.test(t)) {
    return { method: "qris", explicit: true };
  }
  if (/\btransfer\b|\btf\b|\bbca\b|\bbri\b|\bmandiri\b|\bbni\b/.test(t)) {
    return { method: "transfer", explicit: true };
  }
  if (/\btunai\b|\bcash\b|\bkontan\b/.test(t)) {
    return { method: "tunai", explicit: true };
  }
  return { method: "tidak_tahu", explicit: false };
}

function detectPerson(text: string): string | null {
  const match = text.match(/\b((?:ibu|bapak|bu|pak|kak|mbok)\s+[a-z]+)/i);
  if (!match) return null;
  return match[1]
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractItem(text: string, counterparty: string | null): string | null {
  let s = text.toLowerCase();
  s = s.replace(new RegExp(AMOUNT_TOKEN_SOURCE, "gi"), " ");
  if (counterparty) s = s.replace(counterparty.toLowerCase(), " ");
  s = s.replace(
    /\b(jual|terjual|laku|tunai|cash|kontan|qris|qr|transfer|tf|gopay|ovo|dana|shopeepay|spay|ambil|buat|rumah|kasbon|bon|hutang|bayar|lunas|pelunasan|kemarin|beli|belanja|gelas|porsi|pcs|bungkus|cup|pax|dan|yg|yang|keperluan|pribadi|modal|tambah|setor|tarik|bank|ke|di|hari|ini|rp|bca|bri|mandiri|bni|x)\b/g,
    " ",
  );
  s = s.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 80) : null;
}
