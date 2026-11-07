import { describe, expect, it } from "vitest";
import { parseNotes } from "@/lib/parser";
import { parseAmountToken, parseMoneyInput } from "@/lib/rupiah";

describe("parseAmountToken", () => {
  it.each([
    ["15rb", 15_000],
    ["15 rb", 15_000],
    ["15ribu", 15_000],
    ["15 ribu", 15_000],
    ["15k", 15_000],
    ["15 k", 15_000],
    ["1,5jt", 1_500_000],
    ["1.5jt", 1_500_000],
    ["1,5 juta", 1_500_000],
    ["2jt", 2_000_000],
    ["1.500.000", 1_500_000],
    ["Rp15.000", 15_000],
    ["Rp 15.000", 15_000],
    ["25 ribu", 25_000],
  ])("reads %s as %i", (token, expected) => {
    expect(parseAmountToken(token)).toBe(expected);
  });

  it("does not invent ribu for a bare small number", () => {
    expect(parseAmountToken("15")).toBeNull();
    expect(parseAmountToken("0")).toBeNull();
  });
});

describe("parseMoneyInput", () => {
  it("accepts plain rupiah and slang", () => {
    expect(parseMoneyInput("200000")).toBe(200_000);
    expect(parseMoneyInput("200.000")).toBe(200_000);
    expect(parseMoneyInput("200rb")).toBe(200_000);
    expect(parseMoneyInput("0")).toBe(0);
    expect(parseMoneyInput("")).toBeNull();
  });
});

describe("parseNotes", () => {
  it("multiplies 3 x 15rb tunai", () => {
    const [entry] = parseNotes("jual nasi campur 3 x 15rb tunai");
    expect(entry).toMatchObject({
      type: "penjualan",
      amount: 45_000,
      method: "tunai",
      qty: 3,
      needsConfirmation: false,
      parser: "rule",
    });
    expect(entry.item).toContain("nasi");
  });

  it("keeps a trailing price as the total for qris", () => {
    const [entry] = parseNotes("es teh 2 qris 10rb");
    expect(entry).toMatchObject({
      type: "penjualan",
      amount: 10_000,
      method: "qris",
      qty: 2,
      needsConfirmation: false,
    });
  });

  it("reads personal withdrawal, expenses, and kasbon", () => {
    expect(parseNotes("ambil 50rb buat rumah")[0]).toMatchObject({
      type: "ambil_pribadi",
      amount: 50_000,
      method: "tunai",
    });
    expect(parseNotes("bayar gas elpiji 25 ribu")[0]).toMatchObject({
      type: "pengeluaran_usaha",
      amount: 25_000,
      method: "tunai",
    });
    expect(parseNotes("bu komang kasbon kopi 10rb")[0]).toMatchObject({
      type: "kasbon_keluar",
      amount: 10_000,
      counterparty: "Bu Komang",
    });
    expect(parseNotes("pak made bayar kasbon kemarin 20rb cash")[0]).toMatchObject({
      type: "kasbon_bayar",
      amount: 20_000,
      method: "tunai",
      counterparty: "Pak Made",
    });
    expect(parseNotes("bu komang kasbon kopi 2 = 10rb")[0]).toMatchObject({
      type: "kasbon_keluar",
      amount: 10_000,
      qty: 2,
    });
  });

  it("flags a sale with no payment method", () => {
    const [entry] = parseNotes("es jeruk 15rb");
    expect(entry).toMatchObject({
      type: "penjualan",
      amount: 15_000,
      method: "tidak_tahu",
      needsConfirmation: true,
    });
    expect(entry.question).toMatch(/tunai atau QRIS/i);
  });

  it("keeps a payment without an amount beside a valid sale", () => {
    const [payment, sale] = parseNotes("bayar si budi\njual teh 5rb tunai");
    expect(payment).toMatchObject({
      amount: null,
      sourceText: "bayar si budi",
      needsConfirmation: true,
    });
    expect(payment.question).toMatch(/nominal/i);
    expect(sale).toMatchObject({
      type: "penjualan",
      amount: 5_000,
      method: "tunai",
      sourceText: "jual teh 5rb tunai",
    });
  });

  it("does not invent a transaction when there is no amount", () => {
    expect(parseNotes("catatan tanpa angka")).toEqual([]);
    const [entry] = parseNotes("jual nasi tanpa harga");
    expect(entry.amount).toBeNull();
    expect(entry.needsConfirmation).toBe(true);
  });

  it("splits a pasted day into separate entries", () => {
    const entries = parseNotes(
      "jual nasi campur 3 x 15rb tunai\nes teh 2 qris 10rb\nambil 50rb buat rumah",
    );
    expect(entries.map((entry) => entry.amount)).toEqual([45_000, 10_000, 50_000]);
  });

  it("reads setor modal with a decimal juta", () => {
    expect(parseNotes("tambah modal 1,5jt")[0]).toMatchObject({
      type: "setor",
      amount: 1_500_000,
      method: "tunai",
    });
  });
});
