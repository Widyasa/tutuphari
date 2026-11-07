import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://127.0.0.1:43227";
const out = process.env.RECOVERY_OUT ?? "/opt/cursor/artifacts/kasbon-recovery-after";
await mkdir(`${out}/screenshots`, { recursive: true });
await mkdir(`${out}/storage`, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const checks = [];
function note(name, ok, detail) {
  checks.push({ name, ok, detail, utc: new Date().toISOString() });
  console.log(`${ok ? "ok" : "FAIL"} ${name} ${detail}`);
  if (!ok) throw new Error(`${name}: ${detail}`);
}

async function dump(page, name) {
  const raw = await page.evaluate(() => localStorage.getItem("tutuphari.v1"));
  await writeFile(`${out}/storage/${name}.json`, raw ?? "null");
  return raw ? JSON.parse(raw) : null;
}
async function shot(page, id) {
  await page.screenshot({ path: `${out}/screenshots/${id}.png`, fullPage: true });
  console.log(new Date().toISOString(), id);
}
function payments(store) {
  return store.active.entries.filter((entry) => entry.type === "kasbon_bayar");
}
function confirmedAmounts(store) {
  return payments(store).filter((entry) => entry.status === "confirmed").map((entry) => entry.amount).sort((a, b) => a - b);
}

async function fresh(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  return { context, page };
}
async function startDebt(page) {
  await page.locator("#warung").fill("QA-TEST-R3b");
  await page.locator("#modal").fill("200000");
  await page.getByRole("button", { name: "Mulai catat" }).click();
  await page.locator("#draft-note").fill("kasbon bu qatest 30rb tunai");
  await page.getByRole("button", { name: "Kirim — ekstrak catatan" }).click();
  await page.getByRole("button", { name: "Konfirmasi catatan ini" }).click();
  await page.waitForTimeout(200);
}
async function home(page) {
  for (let i = 0; i < 6; i += 1) {
    if (await page.getByRole("heading", { name: "Hari ini", exact: true }).isVisible().catch(() => false)) return;
    if (await page.getByRole("button", { name: "Batalkan ke Hari Ini" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Batalkan ke Hari Ini" }).click();
      continue;
    }
    if (await page.getByRole("button", { name: "Kembali" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Kembali" }).click();
      continue;
    }
    if (await page.getByRole("button", { name: "Hari Ini", exact: true }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Hari Ini", exact: true }).click();
      continue;
    }
    break;
  }
  await page.getByRole("heading", { name: "Hari ini", exact: true }).waitFor();
}
async function pay(page, person, amount) {
  await home(page);
  await page.getByRole("button", { name: "Kasbon", exact: true }).click();
  if (await page.getByRole("button", { name: "Batal" }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Batal" }).click();
  }
  await page.getByRole("button", { name: "Catat bayar kasbon" }).click();
  await page.locator("#pay-name").fill(person);
  await page.locator("#pay-amount").fill(String(amount));
  await page.getByRole("button", { name: "Simpan pembayaran" }).click();
  await page.waitForTimeout(200);
}
async function sendOverpay(page, viewport) {
  await home(page);
  const catat = viewport.width >= 1024 ? "Catat lagi" : "Lanjutkan catat";
  await page.getByRole("button", { name: catat }).click();
  await page.locator("#draft-note").fill("bu qatest bayar kasbon 25rb tunai");
  await page.getByRole("button", { name: "Kirim — ekstrak catatan" }).click();
  await page.getByRole("button", { name: "Konfirmasi catatan ini" }).click();
  await page.getByRole("alert").filter({ hasText: "Draft belum masuk perhitungan" }).waitFor();
}

async function repaidThenDelete(viewport) {
  const tag = `repaid-${viewport.width}`;
  const { context, page } = await fresh(viewport);
  await startDebt(page);
  await pay(page, "Bu Qatest", 10000);
  await sendOverpay(page, viewport);
  await pay(page, "Bu Qatest", 20000);
  await home(page);
  const checkName = viewport.width >= 1024 ? "Periksa catatan" : "Cek catatan";
  await page.getByRole("button", { name: checkName }).click();
  await page.reload({ waitUntil: "networkidle" });
  const before = await dump(page, `${tag}-before-recovery`);
  await shot(page, `${tag}-error`);
  const alert = await page.getByRole("alert").filter({ hasText: "Draft belum masuk perhitungan" }).innerText();
  note(`${tag} repaid alert`, alert.includes("sudah lunas") && alert.includes("Draft belum masuk perhitungan"), alert);
  const kept = confirmedAmounts(before);
  note(`${tag} payments before`, JSON.stringify(kept) === JSON.stringify([10000, 20000]), JSON.stringify(kept));
  await page.getByRole("button", { name: "Hapus draft" }).click();
  await page.getByRole("dialog").getByText("Catatan lain dan pembayaran sah tetap tersimpan.").waitFor();
  await shot(page, `${tag}-delete-dialog`);
  await page.getByRole("dialog").getByRole("button", { name: "Batal" }).click();
  let store = await dump(page, `${tag}-delete-cancelled`);
  note(`${tag} cancel delete`, payments(store).some((entry) => entry.status === "draft" && entry.amount === 25000), "draft remains");
  await page.getByRole("button", { name: "Ubah jumlah" }).click();
  await page.getByLabel("Jumlah pembayaran").fill("15000");
  await shot(page, `${tag}-edit-open`);
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  store = await dump(page, `${tag}-edit-cancelled`);
  note(`${tag} cancel edit`, payments(store).some((entry) => entry.status === "draft" && entry.amount === 25000), "amount unchanged");
  await page.getByRole("button", { name: "Hapus draft" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Hapus draft" }).click();
  await page.getByRole("heading", { name: "Cek sebelum tutup" }).waitFor();
  store = await dump(page, `${tag}-deleted`);
  await shot(page, `${tag}-deleted`);
  note(`${tag} only draft removed`, JSON.stringify(confirmedAmounts(store)) === JSON.stringify([10000, 20000]) && !payments(store).some((entry) => entry.status === "draft"), JSON.stringify(payments(store).map((entry) => [entry.amount, entry.status])));
  await home(page);
  await page.getByRole("button", { name: "Tutup hari" }).click();
  if ((await page.locator("#counted-cash").inputValue()) === "") await page.locator("#counted-cash").fill("200000");
  await page.getByRole("button", { name: "Lihat hasil" }).click();
  await page.getByRole("heading", { name: "Hasil tutup hari" }).waitFor();
  const hasil = await page.locator("body").innerText();
  await shot(page, `${tag}-hasil-200`);
  note(`${tag} hasil 200`, hasil.includes("Rp200.000"), "expected");
  await page.getByRole("button", { name: "Selesai — ke Hari Ini" }).click();
  store = await dump(page, `${tag}-closed`);
  note(`${tag} closed`, store.active.closedAt != null, String(store.active.closedAt));
  note(`${tag} closed payments`, JSON.stringify(confirmedAmounts(store)) === JSON.stringify([10000, 20000]), "ids stable");
  await context.close();
}

async function editWhileRemaining(viewport) {
  const tag = `edit-${viewport.width}`;
  const { context, page } = await fresh(viewport);
  await startDebt(page);
  await pay(page, "Bu Qatest", 10000);
  await sendOverpay(page, viewport);
  const before = await dump(page, `${tag}-before`);
  note(`${tag} starts at 25k draft`, before.active.entries.some((entry) => entry.amount === 25000 && entry.status === "draft"), "before");
  await shot(page, `${tag}-over-20`);
  const alert = await page.getByRole("alert").filter({ hasText: "Draft belum masuk perhitungan" }).innerText();
  note(`${tag} exceeds copy`, alert.includes("Rp25.000 melebihi sisa utang Rp20.000. Draft belum masuk perhitungan."), alert);
  await page.getByRole("button", { name: "Ubah jumlah" }).click();
  const prefilled = await page.getByLabel("Jumlah pembayaran").inputValue();
  const remain = await page.getByLabel("Sisa utang").inputValue();
  note(`${tag} prefilled`, prefilled === "Rp25.000" && remain === "Rp20.000", `${prefilled} / ${remain}`);
  await page.getByLabel("Jumlah pembayaran").fill("15000");
  await page.getByRole("button", { name: "Batal", exact: true }).click();
  let store = await dump(page, `${tag}-cancel`);
  note(`${tag} cancel keeps 25k`, payments(store).some((entry) => entry.status === "draft" && entry.amount === 25000), "draft");
  await page.getByRole("button", { name: "Ubah jumlah" }).click();
  await page.getByLabel("Jumlah pembayaran").fill("20000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  store = await dump(page, `${tag}-saved-draft`);
  await shot(page, `${tag}-saved-draft`);
  const edited = payments(store).find((entry) => entry.amount === 20000 && entry.status === "draft");
  note(`${tag} save stays draft`, Boolean(edited) && confirmedAmounts(store).join() === "10000", JSON.stringify(payments(store).map((entry) => [entry.amount, entry.status])));
  await page.reload({ waitUntil: "networkidle" });
  store = await dump(page, `${tag}-reload`);
  note(`${tag} reload draft`, payments(store).some((entry) => entry.amount === 20000 && entry.status === "draft"), "reload");
  await page.getByRole("button", { name: "Konfirmasi catatan ini" }).click();
  await page.waitForTimeout(200);
  store = await dump(page, `${tag}-confirmed`);
  await shot(page, `${tag}-confirmed`);
  note(`${tag} confirm once`, JSON.stringify(confirmedAmounts(store)) === JSON.stringify([10000, 20000]), JSON.stringify(confirmedAmounts(store)));
  note(`${tag} no extra draft`, !payments(store).some((entry) => entry.status === "draft"), "drafts");
  await home(page);
  const body = await page.locator("body").innerText();
  await shot(page, `${tag}-home-200`);
  note(`${tag} expected 200`, body.includes("Rp200.000"), "home");
  await context.close();
}

try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await repaidThenDelete(viewport);
    await editWhileRemaining(viewport);
  }
  await writeFile(`${out}/checks.json`, JSON.stringify({ ok: true, checks }, null, 2));
  console.log(`PASS ${checks.length}`);
} catch (error) {
  await writeFile(`${out}/checks.json`, JSON.stringify({ ok: false, checks, error: String(error.stack || error) }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
