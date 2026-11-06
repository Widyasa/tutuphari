import { todayInBali } from "@/lib/dates";
import { createId } from "@/lib/id";
import type { DayRecord } from "@/lib/types";

export function createDay(input: {
  warungName: string;
  modalAwal: number;
  now?: Date;
}): DayRecord {
  return {
    id: createId(),
    warungName: input.warungName.trim() || "Warung saya",
    place: null,
    date: todayInBali(input.now ?? new Date()),
    isDemo: false,
    modalAwal: Math.max(0, Math.round(input.modalAwal)),
    notes: [],
    entries: [],
    countedCash: null,
    countedQris: null,
    closedAt: null,
    priorKasbon: [],
  };
}
