import { describe, expect, it } from "vitest";
import { createDemoDay } from "@/lib/demo";
import { canCountDrawer, closeGate, reduceNav, showsBottomNav, type NavState } from "@/lib/flow";

const home: NavState = { dest: "hari", step: null, draft: "" };

describe("v3 navigation", () => {
  it("hides the bottom nav only inside the close flow", () => {
    expect(showsBottomNav(null)).toBe(true);
    expect(showsBottomNav("catat")).toBe(false);
    expect(showsBottomNav("konfirmasi")).toBe(false);
    expect(showsBottomNav("hasil")).toBe(false);
  });

  it("keeps the typed draft across Back, destination changes, and browser-back steps", () => {
    const typed = reduceNav({ ...home, step: "catat" }, { type: "type", text: "jual es teh 2 10rb" });
    const homeAgain = reduceNav(typed, { type: "back", hasUnclear: true });
    expect(homeAgain).toEqual({ dest: "hari", step: null, draft: "jual es teh 2 10rb" });
    const kasbon = reduceNav(homeAgain, { type: "dest", dest: "kasbon" });
    expect(kasbon.draft).toBe("jual es teh 2 10rb");
    expect(kasbon.step).toBeNull();
    const returned = reduceNav(kasbon, { type: "step", step: "catat" });
    expect(returned.draft).toBe("jual es teh 2 10rb");
  });

  it("blocks the drawer count until an unclear note is chosen and then confirmed", () => {
    const day = createDemoDay(new Date("2026-11-06T12:00:00+08:00"));
    expect(closeGate(day.entries)).toBe("ambigu");
    expect(canCountDrawer(day.entries)).toBe(false);

    const chosen = day.entries.map((entry) =>
      entry.id === "demo-entry-7" ? { ...entry, method: "qris" as const, needsConfirmation: false } : entry,
    );
    expect(closeGate(chosen)).toBe("konfirmasi");
    expect(canCountDrawer(chosen)).toBe(false);

    const confirmed = chosen.map((entry) =>
      entry.id === "demo-entry-7" ? { ...entry, status: "confirmed" as const } : entry,
    );
    expect(closeGate(confirmed)).toBe("hitung");
    expect(canCountDrawer(confirmed)).toBe(true);
  });
});
