import { todayInBali } from "@/lib/dates";
import type { DayRecord, Entry } from "@/lib/types";

export const DEMO_MODAL = 200_000;
export const DEMO_COUNTED_CASH = 270_000;
export const DEMO_COUNTED_QRIS = 10_000;

function entry(partial: Entry): Entry {
  return partial;
}

/** Synthetic day for judges. The Rp15.000 gap closes once "es jeruk" is tunai. */
export function createDemoDay(now = new Date()): DayRecord {
  const date = todayInBali(now);
  const note = (id: string, text: string, minute: string) => ({
    id,
    text,
    createdAt: `${date}T${minute}:00+08:00`,
  });

  const notes = [
    note("demo-note-1", "jual nasi campur 8 x 15rb tunai", "11:05"),
    note("demo-note-2", "es teh 2 qris 10rb", "11:40"),
    note("demo-note-3", "ambil 50rb buat rumah", "13:10"),
    note("demo-note-4", "bayar gas elpiji 25 ribu", "14:00"),
    note("demo-note-5", "bu wayan kasbon kopi 10rb", "15:20"),
    note("demo-note-6", "pak made bayar kasbon kemarin 20rb cash", "16:05"),
    note("demo-note-7", "es jeruk 15rb", "17:30"),
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
      type: "penjualan",
      amount: 10_000,
      method: "qris",
      item: "es teh",
      qty: 2,
      counterparty: null,
      confidence: 0.94,
      sourceText: notes[1].text,
      needsConfirmation: false,
      question: null,
      parser: "demo",
      status: "confirmed",
    }),
    entry({
      id: "demo-entry-3",
      noteId: "demo-note-3",
      type: "ambil_pribadi",
      amount: 50_000,
      method: "tunai",
      item: null,
      qty: null,
      counterparty: null,
      confidence: 0.93,
      sourceText: notes[2].text,
      needsConfirmation: false,
      question: null,
      parser: "demo",
      status: "confirmed",
    }),
    entry({
      id: "demo-entry-4",
      noteId: "demo-note-4",
      type: "pengeluaran_usaha",
      amount: 25_000,
      method: "tunai",
      item: "gas elpiji",
      qty: null,
      counterparty: null,
      confidence: 0.9,
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
      type: "kasbon_bayar",
      amount: 20_000,
      method: "tunai",
      item: null,
      qty: null,
      counterparty: "Pak Made",
      confidence: 0.92,
      sourceText: notes[5].text,
      needsConfirmation: false,
      question: null,
      parser: "demo",
      status: "confirmed",
    }),
    entry({
      id: "demo-entry-7",
      noteId: "demo-note-7",
      type: "penjualan",
      amount: 15_000,
      method: "tidak_tahu",
      item: "es jeruk",
      qty: null,
      counterparty: null,
      confidence: 0.45,
      sourceText: notes[6].text,
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
        amount: 20_000,
        note: "Kasbon kemarin (contoh)",
      },
    ],
  };
}
