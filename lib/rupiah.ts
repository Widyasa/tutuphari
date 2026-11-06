const SUFFIX =
  /(?:ribu|rbu|rb|juta|jt|k)$/;

/**
 * Read one rupiah token from warung notes.
 * "15rb", "15 k", "1,5jt", and "1.500.000" are accepted.
 * A bare small number such as "15" is not treated as rupiah.
 */
export function parseAmountToken(input: string): number | null {
  let s = input.trim().toLowerCase().replace(/\s+/g, "");
  s = s.replace(/^rp/, "");
  if (!s) return null;

  let mult = 1;
  if (/(?:ribu|rbu|rb|k)$/.test(s)) {
    mult = 1_000;
    s = s.replace(/(?:ribu|rbu|rb|k)$/, "");
  } else if (/(?:juta|jt)$/.test(s)) {
    mult = 1_000_000;
    s = s.replace(/(?:juta|jt)$/, "");
  }

  if (!s || !/^[\d.,]+$/.test(s)) return null;

  let value: number;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    value = Number(s.replace(/\./g, ""));
  } else if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    value = Number(s.replace(/,/g, ""));
  } else if (/^\d+[.,]\d+$/.test(s)) {
    if (mult === 1) return null;
    value = Number(s.replace(",", "."));
  } else if (/^\d+$/.test(s)) {
    value = Number(s);
    if (mult === 1 && value < 1_000) return null;
  } else {
    return null;
  }

  if (!Number.isFinite(value)) return null;
  const amount = Math.round(value * mult);
  if (amount <= 0 || amount > 1_000_000_000_000) return null;
  return amount;
}

/** Money typed into a field, where "200000" and "200.000" both mean rupiah. */
export function parseMoneyInput(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (SUFFIX.test(trimmed.replace(/\s+/g, "")) || /(?:ribu|juta)/.test(trimmed)) {
    return parseAmountToken(trimmed);
  }
  const normalized = trimmed.replace(/^rp\s*/, "").replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    return Number(normalized.replace(/\./g, ""));
  }
  if (/^\d+$/.test(normalized)) {
    const n = Number(normalized);
    return n >= 0 && n <= 1_000_000_000_000 ? n : null;
  }
  return parseAmountToken(trimmed);
}

export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const body = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}Rp${body}`;
}

export const AMOUNT_TOKEN_SOURCE =
  "(?:rp\\s*)?(?:\\d{1,3}(?:\\.\\d{3})+|\\d{1,3}(?:,\\d{3})+)(?:\\s*(?:ribu|rbu|juta|rb|jt|k))?|(?:rp\\s*)?\\d+(?:[.,]\\d+)?\\s*(?:ribu|rbu|juta|rb|jt|k)|(?:rp\\s*)?\\d{4,}";
