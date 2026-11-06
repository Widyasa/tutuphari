import type { Entry } from "@/lib/types";

export type Dest = "hari" | "kasbon" | "riwayat";

export type Step =
  | "catat"
  | "loading"
  | "fallback"
  | "ambigu"
  | "konfirmasi"
  | "hitung"
  | "hasil"
  | "export";

export type NavState = {
  dest: Dest;
  step: Step | null;
  draft: string;
};

export function showsBottomNav(step: Step | null): boolean {
  return step == null;
}

export function progressOf(step: Step): { title: string; meta: string } {
  switch (step) {
    case "catat":
    case "loading":
    case "fallback":
      return { title: "Catat", meta: "Catat · 1 dari 4" };
    case "ambigu":
    case "konfirmasi":
      return { title: "Cek", meta: "Cek · 2 dari 4" };
    case "hitung":
    case "hasil":
      return { title: "Tutup", meta: "Tutup · 3 dari 4" };
    case "export":
      return { title: "Bagikan", meta: "Bagikan · 4 dari 4" };
  }
}

/** Where Tutup hari may start. Hasil stays unreachable until the gate says hitung. */
export function closeGate(entries: Pick<Entry, "method" | "status" | "needsConfirmation">[]): Step {
  if (entries.some((entry) => entry.method === "tidak_tahu")) return "ambigu";
  if (entries.some((entry) => entry.status !== "confirmed" || entry.needsConfirmation)) {
    return "konfirmasi";
  }
  return "hitung";
}

export function canCountDrawer(entries: Pick<Entry, "method" | "status" | "needsConfirmation">[]): boolean {
  return closeGate(entries) === "hitung";
}

export function backTarget(state: NavState, hasUnclear: boolean): NavState {
  if (!state.step) return state;
  const draft = state.draft;
  switch (state.step) {
    case "loading":
    case "fallback":
    case "ambigu":
      return { dest: state.dest, step: "catat", draft };
    case "catat":
      return { dest: "hari", step: null, draft };
    case "konfirmasi":
      return { dest: state.dest, step: hasUnclear ? "ambigu" : "catat", draft };
    case "hitung":
      return { dest: state.dest, step: "konfirmasi", draft };
    case "hasil":
      return { dest: state.dest, step: "hitung", draft };
    case "export":
      return { dest: state.dest, step: "hasil", draft };
  }
}

export type NavAction =
  | { type: "type"; text: string }
  | { type: "dest"; dest: Dest }
  | { type: "step"; step: Step | null }
  | { type: "back"; hasUnclear: boolean }
  | { type: "home" };

export function reduceNav(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case "type":
      return { ...state, draft: action.text };
    case "dest":
      return { ...state, dest: action.dest, step: null };
    case "step":
      return { ...state, step: action.step };
    case "back":
      return backTarget(state, action.hasUnclear);
    case "home":
      return { ...state, dest: "hari", step: null };
  }
}
