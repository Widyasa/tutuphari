export const ENTRY_TYPES = [
  "penjualan",
  "pengeluaran_usaha",
  "ambil_pribadi",
  "kasbon_keluar",
  "kasbon_bayar",
  "setor",
  "tarik",
  "lainnya",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export const METHODS = ["tunai", "qris", "transfer", "tidak_tahu"] as const;

export type Method = (typeof METHODS)[number];

export type ParserKind = "ai" | "rule" | "demo";

export type EntryStatus = "draft" | "confirmed";

export type ExtractedEntry = {
  type: EntryType;
  amount: number | null;
  method: Method;
  item: string | null;
  qty: number | null;
  counterparty: string | null;
  confidence: number;
  sourceText: string;
  needsConfirmation: boolean;
  question: string | null;
  parser: ParserKind;
};

export type Entry = ExtractedEntry & {
  id: string;
  noteId: string;
  status: EntryStatus;
};

export type Note = {
  id: string;
  text: string;
  createdAt: string;
  warning?: string;
};

export type PriorKasbon = {
  person: string;
  amount: number;
  note: string;
};

export type DayRecord = {
  id: string;
  warungName: string;
  place: string | null;
  date: string;
  isDemo: boolean;
  modalAwal: number;
  notes: Note[];
  entries: Entry[];
  countedCash: number | null;
  countedQris: number | null;
  closedAt: string | null;
  priorKasbon: PriorKasbon[];
  /** Unsent note text. Survives navigation, Back, and reload. */
  draftNote?: string;
};

export type Store = {
  version: 1;
  active: DayRecord | null;
  history: DayRecord[];
};

export const TYPE_LABEL: Record<EntryType, string> = {
  penjualan: "Penjualan",
  pengeluaran_usaha: "Pengeluaran",
  ambil_pribadi: "Ambil pribadi",
  kasbon_keluar: "Kasbon keluar",
  kasbon_bayar: "Kasbon dibayar",
  setor: "Setor modal",
  tarik: "Tarik / ke bank",
  lainnya: "Lainnya",
};

export const METHOD_LABEL: Record<Method, string> = {
  tunai: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
  tidak_tahu: "Belum jelas",
};

export function isEntryType(value: string): value is EntryType {
  return (ENTRY_TYPES as readonly string[]).includes(value);
}

export function isMethod(value: string): value is Method {
  return (METHODS as readonly string[]).includes(value);
}
