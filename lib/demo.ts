import { todayInBali } from "@/lib/dates";
import type { DayRecord, Entry } from "@/lib/types";

export function createDemoHistory(): DayRecord[] {
  const closed = (
    id: string,
    date: string,
    modalAwal: number,
    penjualan: number,
    countedCash: number,
  ): DayRecord => ({
    id,
    warungName: "Warung Bu Komang",
    place: "Denpasar",
    date,
    isDemo: true,
    modalAwal,
    notes: [],
    entries: [
      {
        id: `${id}-jual`,
        noteId: `${id}-note`,
        type: "penjualan",
        amount: penjualan,
        method: "tunai",
        item: "nasi campur",
        qty: null,
        counterparty: null,
        confidence: 1,
        sourceText: "contoh hari sebelumnya",
        needsConfirmation: false,
        question: null,
        parser: "demo",
        status: "confirmed",
      },
    ],
    countedCash,
    countedQris: null,
    closedAt: `${date}T21:00:00+08:00`,
    priorKasbon: [],
  });

  return [
    closed("demo-history-kamis", "2026-11-05", 200_000, 10_000, 210_000),
    closed("demo-history-rabu", "2026-11-04", 190_000, 8_000, 206_000),
  ];
}

export const DEMO_MODAL = 200_000;
export const DEMO_COUNTED_CASH = 240_000;
export const DEMO_COUNTED_QRIS = null;

function entry(partial: Entry): Entry {
  return partial;
}

/**
 * Synthetic day for judges, aligned with the design ledger.
 * Confirmed cash nets to Rp255.000. The es teh note stays out until chosen.
 */
export function createDemoDay(now = new Date()): DayRecord {
  const date = todayInBali(now);
  const note = (id: string, text: string, minute: string) => ({
    id,
    text,
    createdAt: `${date}T${minute}:00+08:00`,
  });

  const notes = [
    note("demo-note-1", "jual nasi campur 8 x 15rb tunai", "11:05"),
    note("demo-note-2", "pak made bayar kasbon kemarin 20rb cash", "12:10"),
    note("demo-note-3", "bayar gas elpiji 25 ribu", "14:00"),
    note("demo-note-4", "ambil 50rb buat rumah", "15:10"),
    note("demo-note-5", "bu wayan kasbon kopi 10rb", "16:20"),
    note("demo-note-6", "jual es teh 2 10rb", "17:30"),
  ];

  const entries: Entry[] = [
    entry({
      id: "demo-entry-1",
      noteId: "demo-note-1",
      type: "penjualan",
      amount: 120_000,
      method: "tunai",
      item: "nasi campur",
      qty: 8,
      counterparty: null,
      confidence: 0.95,
      sourceText: notes[0].text,
      needsConfirmation: false,
      question: null,
      parser: "demo",
      status: "confirmed",
    }),
    entry({
      id: "demo-entry-2",
      noteId: "demo-note-2",
      type: "kasbon_bayar",
      amount: 20_000,
      method: "tunai",
      item: null,
      qty: null,
      counterparty: "Pak Made",
      confidence: 0.92,
      sourceText: notes[1].text,
      needsConfirmation: false,
      question: null,
      parser: "demo",
      status: "confirmed",
    }),
    entry({
      id: "demo-entry-3",
      noteId: "demo-note-3",
      type: "pengeluaran_usaha",
      amount: 25_000,
      method: "tunai",
      item: "gas elpiji",
      qty: null,
      counterparty: null,
      confidence: 0.9,
      sourceText: notes[2].text,
      needsConfirmation: false,
      question: null,
      parser: "demo",
      status: "confirmed",
    }),
    entry({
      id: "demo-entry-4",
      noteId: "demo-note-4",
      type: "ambil_pribadi",
      amount: 50_000,
      method: "tunai",
      item: null,
      qty: null,
      counterparty: null,
      confidence: 0.93,
      sourceText: notes[3].text,
      needsConfirmation: false,
      question: null,
      parser: "demo",
      status: "confirmed",
    }),
    entry({
      id: "demo-entry-5",
      noteId: "demo-note-5",
      type: "kasbon_keluar",
      amount: 10_000,
      method: "tunai",
      item: "kopi",
      qty: null,
      counterparty: "Bu Wayan",
      confidence: 0.9,
      sourceText: notes[4].text,
      needsConfirmation: false,
      question: null,
      parser: "demo",
      status: "confirmed",
    }),
    entry({
      id: "demo-entry-6",
      noteId: "demo-note-6",
      type: "penjualan",
      amount: 10_000,
      method: "tidak_tahu",
      item: "es teh",
      qty: 2,
      counterparty: null,
      confidence: 0.45,
      sourceText: notes[5].text,
      needsConfirmation: true,
      question: "Ini tunai atau QRIS?",
      parser: "demo",
      status: "draft",
    }),
  ];

  return {
    id: "demo-bu-komang",
    warungName: "Warung Bu Komang",
    place: "Denpasar",
    date,
    isDemo: true,
    modalAwal: DEMO_MODAL,
    notes,
    entries,
    countedCash: DEMO_COUNTED_CASH,
    countedQris: DEMO_COUNTED_QRIS,
    closedAt: null,
    priorKasbon: [
      {
        person: "Pak Made",
        amount: 35_000,
        note: "Saldo sebelum pelunasan hari ini (contoh)",
      },
      {
        person: "Bu Komang",
        amount: 20_000,
        note: "Kasbon belum dibayar (contoh)",
      },
    ],
  };
}
