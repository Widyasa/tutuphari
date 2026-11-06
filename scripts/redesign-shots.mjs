import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://127.0.0.1:43219";
const out = "/opt/cursor/artifacts/redesign";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
const shots = [];
const checks = [];

function note(name, ok, detail) {
  checks.push({ name, ok, detail });
  if (!ok) throw new Error(`${name}: ${detail}`);
}

async function shot(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = `${out}/${name}-mobile.png`;
  await page.screenshot({ path: mobile });
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  note(`${name} mobile no horizontal scroll`, !mobileOverflow, `scrollWidth overflow=${mobileOverflow}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktop = `${out}/${name}-desktop.png`;
  await page.screenshot({ path: desktop });
  const desktopOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  note(`${name} desktop no horizontal scroll`, !desktopOverflow, `scrollWidth overflow=${desktopOverflow}`);
  shots.push(mobile, desktop);
  await page.setViewportSize({ width: 390, height: 844 });
}

async function click(name) {
  await page.getByRole("button", { name, exact: true }).click();
}

await page.goto(base, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload({ waitUntil: "networkidle" });
await click("Coba demo");
await page.getByTestId("home-expected").waitFor();
const homeText = await page.locator("body").innerText();
note("home copy avoids Expected", !/expected/i.test(homeText), "found Expected");
note("home copy avoids terkunci", !/terkunci/i.test(homeText), "found terkunci");
note("home shows 255", homeText.includes("Rp255.000"), homeText.slice(0, 400));
note("home shows omzet 120", homeText.includes("Rp120.000"), "missing omzet");
note("home shows tunai masuk 140", homeText.includes("Rp140.000"), "missing tunai masuk");
await shot("home");

await page.getByRole("button", { name: "Kasbon", exact: true }).click();
await page.getByText("Rp45.000").first().waitFor();
await shot("kasbon");

await page.getByRole("button", { name: "Riwayat", exact: true }).click();
await page.getByRole("heading", { name: "Riwayat" }).waitFor();
await shot("riwayat");

await page.getByRole("button", { name: "Hari Ini", exact: true }).click();
await click("Lanjutkan catat");
await page.locator("#draft-note").fill("jual es teh 2 10rb");
await shot("catat");

await page.locator("#draft-note").focus();
await page.waitForTimeout(150);
await page.evaluate(() => document.documentElement.style.setProperty("--kb", "320px"));
const keyboardPath = `${out}/keyboard-catat-mobile.png`;
await page.screenshot({ path: keyboardPath });
shots.push(keyboardPath);
const cta = await page.getByTestId("primary-cta").boundingBox();
note("keyboard cta box", !!cta, "missing cta");
if (cta) {
  note(
    "keyboard cta above inset",
    cta.y + cta.height <= 844 - 300,
    `cta bottom ${Math.round(cta.y + cta.height)}`,
  );
}
await page.evaluate(() => document.documentElement.style.setProperty("--kb", "0px"));

await click("Kembali");
await page.getByTestId("home-expected").waitFor();
await click("Lanjutkan catat");
note("back keeps draft", (await page.locator("#draft-note").inputValue()) === "jual es teh 2 10rb", "draft missing after back");

await page.goBack();
await page.getByTestId("home-expected").waitFor();
await page.goForward();
await page.locator("#draft-note").waitFor();
note(
  "browser back keeps draft",
  (await page.locator("#draft-note").inputValue()) === "jual es teh 2 10rb",
  "draft missing after history",
);

await page.reload({ waitUntil: "networkidle" });
await page.locator("#draft-note").waitFor({ timeout: 5000 });
note(
  "reload keeps draft",
  (await page.locator("#draft-note").inputValue()) === "jual es teh 2 10rb",
  "draft missing after reload",
);
await click("Kembali");
await page.getByTestId("home-expected").waitFor();
const stored = await page.evaluate(() => localStorage.getItem("tutuphari.v1") ?? "");
note("reload keeps ledger", stored.includes("120000") && stored.includes("jual es teh 2 10rb"), "store missing demo entries");

await click("Tutup hari");
await page.getByRole("heading", { name: "Perlu kamu pilih" }).waitFor();
await shot("ambigu");
await page.getByRole("button", { name: /QRIS/ }).click();
await click("Lanjut cek catatan");
await page.getByRole("heading", { name: "Cek sebelum tutup" }).waitFor();
await shot("konfirmasi");
await click("Konfirmasi catatan ini");
await click("Lanjut hitung laci");
await click("Lihat hasil");
await page.getByRole("heading", { name: "Hasil tutup hari" }).waitFor();
const hasil = await page.locator("body").innerText();
note("hasil kurang 15", hasil.includes("Rp15.000") && hasil.includes("Kurang"), hasil.slice(0, 500));
note("hasil keeps 255", hasil.includes("Rp255.000"), "expected changed");
await shot("hasil");
await click("Bagikan rekap");
await page.getByRole("heading", { name: "Bagikan rekap" }).waitFor();
await shot("export");

const { writeFile } = await import("node:fs/promises");
await writeFile(`${out}/checks.json`, JSON.stringify({ checks, shots }, null, 2));
await browser.close();
console.log(JSON.stringify({ shots, checks }, null, 2));
