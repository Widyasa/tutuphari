import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://127.0.0.1:43227";
const out = process.env.MATRIX_OUT ?? "/opt/cursor/artifacts/qa-draft-matrix";
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
  await page.screenshot({ path: `${out}/screenshots/${id}.png` });
}
async function fresh(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle" });
  return { context, page };
}
async function clickCard(card, name) {
  const button = card.getByRole("button", { name });
  await button.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await button.click();
}
async function home(page) {
  for (let i = 0; i < 6; i += 1) {
    if (await page.getByRole("heading", { name: "Hari ini", exact: true }).isVisible().catch(() => false)) return;
    const back = page.getByRole("button", { name: "Batalkan ke Hari Ini" });
    if (await back.isVisible().catch(() => false)) { await back.click(); continue; }
    const kembali = page.getByRole("button", { name: "Kembali" });
    if (await kembali.isVisible().catch(() => false)) { await kembali.click(); continue; }
    const hari = page.getByRole("button", { name: "Hari Ini", exact: true });
    if (await hari.isVisible().catch(() => false)) { await hari.click(); continue; }
    break;
  }
}
async function send(page, viewport, text) {
  if ((await page.locator("#draft-note").count()) === 0) {
    await home(page);
    await page.getByRole("button", { name: viewport.width >= 1024 ? "Catat lagi" : "Lanjutkan catat" }).click();
  }
  await page.locator("#draft-note").fill(text);
  await page.getByRole("button", { name: "Kirim — ekstrak catatan" }).click();
  await page.getByTestId("read-label").waitFor({ timeout: 15000 });
}

const cases = [
  ["jual-tunai", "jual kopi 20rb tunai", "penjualan", "tunai", true, false],
  ["jual-qris", "es teh qris 10rb", "penjualan", "qris", true, false],
  ["jual-unknown", "es jeruk 15rb", "penjualan", "tidak_tahu", true, false],
  ["keluar", "bayar gas elpiji 5 ribu tunai", "pengeluaran_usaha", "tunai", true, false],
  ["ambil", "ambil 8rb buat rumah", "ambil_pribadi", "tunai", true, false],
  ["bon-keluar", "kasbon bu sari 12rb tunai", "kasbon_keluar", "tunai", true, true],
];

async function run(viewport) {
  const tag = String(viewport.width);
  const { context, page } = await fresh(viewport);
  await page.locator("#warung").fill("QA-MATRIX");
  await page.locator("#modal").fill("200000");
  await page.getByRole("button", { name: "Mulai catat" }).click();
  for (const [id, text, type, method, showsPay, showsName] of cases) {
    await send(page, viewport, text);
    const listed = page.locator("li", { hasText: text });
    const card = (await listed.count()) ? listed.first() : page.locator("#app-shell");
    await clickCard(card, "Ubah catatan");
    await shot(page, `${tag}-${id}-editor`);
    const labels = await page.locator("label").allInnerTexts();
    note(`${tag} ${id} jenis`, labels.includes("Jenis catatan"), labels.join(","));
    note(`${tag} ${id} jumlah`, labels.includes("Jumlah"), labels.join(","));
    note(`${tag} ${id} cara`, labels.includes("Cara bayar") === showsPay, labels.join(","));
    note(`${tag} ${id} nama`, labels.includes("Nama") === showsName, labels.join(","));
    note(`${tag} ${id} asli`, (await card.innerText()).includes("Catatan asli"), "trace");
    const original = await page.getByLabel("Jumlah").inputValue();
    await page.getByLabel("Jumlah").fill("99999");
    await page.getByRole("button", { name: "Batal", exact: true }).click();
    let store = await dump(page, `${tag}-${id}-cancel`);
    const row = store.active.entries.find((entry) => entry.sourceText === text);
    note(`${tag} ${id} type`, row?.type === type && row?.method === method, `${row?.type}/${row?.method}`);
    note(`${tag} ${id} cancel`, row?.status === "draft" && String(row?.amount) !== "99999", String(row?.amount));
    await clickCard(card, "Ubah catatan");
    await page.getByLabel("Jumlah").fill(String(Math.max(1000, (row.amount ?? 1000) - 1000)));
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await card.getByText("Perubahan disimpan sebagai draft").waitFor();
    store = await dump(page, `${tag}-${id}-saved`);
    const saved = store.active.entries.find((entry) => entry.sourceText === text);
    note(`${tag} ${id} still draft`, saved?.status === "draft" && saved?.sourceText === text, saved?.status);
    note(`${tag} ${id} amount changed`, saved?.amount === Math.max(1000, (row.amount ?? 1000) - 1000), String(saved?.amount));
    await page.reload({ waitUntil: "networkidle" });
    store = await dump(page, `${tag}-${id}-reload`);
    const reloaded = store.active.entries.find((entry) => entry.sourceText === text);
    note(`${tag} ${id} reload`, reloaded?.status === "draft" && reloaded?.amount === saved.amount && reloaded?.sourceText === text, "reload");
    if (method === "tidak_tahu") {
      const scope = (await page.locator("li", { hasText: text }).count()) ? page.locator("li", { hasText: text }).first() : page.locator("#app-shell");
      await clickCard(scope, "Konfirmasi catatan ini");
      const blocked = await page.getByRole("alert").filter({ hasText: "Cara bayar belum diketahui" }).innerText();
      store = await dump(page, `${tag}-${id}-confirm-blocked`);
      note(`${tag} ${id} confirm blocked`, store.active.entries.find((entry) => entry.sourceText === text)?.status === "draft" && blocked.includes("Draft belum masuk perhitungan"), blocked);
      await home(page);
      const gateLabel = viewport.width >= 1024 ? "Periksa catatan" : "Cek catatan";
      note(`${tag} ${id} gate`, await page.getByRole("button", { name: gateLabel }).isVisible() && !(await page.getByRole("button", { name: "Tutup hari" }).isVisible().catch(() => false)), gateLabel);
      await page.getByRole("button", { name: gateLabel }).click();
      const scope2 = (await page.locator("li", { hasText: text }).count()) ? page.locator("li", { hasText: text }).first() : page.locator("#app-shell");
      await clickCard(scope2, "Hapus draft");
      await page.getByRole("dialog").getByRole("button", { name: "Batal" }).click();
      store = await dump(page, `${tag}-${id}-delete-cancel`);
      note(`${tag} ${id} delete cancel`, store.active.entries.some((entry) => entry.sourceText === text), "kept");
      await clickCard(scope2, "Hapus draft");
      await page.getByRole("dialog").getByRole("button", { name: "Hapus draft" }).click();
      store = await dump(page, `${tag}-${id}-deleted`);
      note(`${tag} ${id} deleted only`, !store.active.entries.some((entry) => entry.sourceText === text) && store.active.entries.length === store.active.entries.filter((entry) => entry.sourceText !== text).length, "gone");
    }
    console.log("done", tag, id, "expected original amount field", original);
  }
  await home(page);
  const body = await page.locator("body").innerText();
  await shot(page, `${tag}-home-after-drafts`);
  note(`${tag} confirmed untouched`, !body.includes("Rp999"), "home");
  const finalStore = await dump(page, `${tag}-final`);
  note(`${tag} no confirmed yet`, finalStore.active.entries.every((entry) => entry.status === "draft"), finalStore.active.entries.map((entry) => entry.status).join(","));
  await context.close();
}

async function raise(viewport) {
  const tag = `raise-${viewport.width}`;
  const { context, page } = await fresh(viewport);
  await page.locator("#warung").fill("QA-RAISE");
  await page.locator("#modal").fill("200000");
  await page.getByRole("button", { name: "Mulai catat" }).click();
  await send(page, viewport, "kasbon bu qatest 30rb tunai");
  await page.getByRole("button", { name: "Konfirmasi catatan ini" }).click();
  await home(page);
  await page.getByRole("button", { name: "Kasbon", exact: true }).click();
  await page.getByRole("button", { name: "Catat bayar kasbon" }).click();
  await page.locator("#pay-name").fill("Bu Qatest");
  await page.locator("#pay-amount").fill("10000");
  await page.getByRole("button", { name: "Simpan pembayaran" }).click();
  await home(page);
  await page.getByRole("button", { name: viewport.width >= 1024 ? "Catat lagi" : "Lanjutkan catat" }).click();
  await send(page, viewport, "bu qatest bayar kasbon 20rb tunai");
  const before = await dump(page, `${tag}-before`);
  const confirmedBefore = before.active.entries.filter((entry) => entry.status === "confirmed").map((entry) => entry.amount).sort();
  await page.locator("li", { hasText: "20rb" }).getByRole("button", { name: "Ubah catatan" }).click();
  await page.getByLabel("Jumlah").fill("30000");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await page.getByText("Perubahan disimpan sebagai draft").waitFor();
  let store = await dump(page, `${tag}-saved`);
  await shot(page, `${tag}-saved`);
  const draft = store.active.entries.find((entry) => entry.sourceText.includes("20rb"));
  note(`${tag} saved draft 30k`, draft?.status === "draft" && draft?.amount === 30000, String(draft?.amount));
  await page.locator("li", { hasText: "20rb" }).getByRole("button", { name: "Konfirmasi catatan ini" }).click();
  await page.getByRole("alert").filter({ hasText: "melebihi sisa utang" }).waitFor();
  store = await dump(page, `${tag}-rejected`);
  await shot(page, `${tag}-rejected`);
  const after = store.active.entries.find((entry) => entry.id === draft.id);
  const confirmedAfter = store.active.entries.filter((entry) => entry.status === "confirmed").map((entry) => entry.amount).sort();
  note(`${tag} still draft`, after?.status === "draft" && after?.amount === 30000, after?.status);
  note(`${tag} ledger`, JSON.stringify(confirmedBefore) === JSON.stringify(confirmedAfter), JSON.stringify(confirmedAfter));
  await context.close();
}

try {
  await run({ width: 1440, height: 900 });
  await run({ width: 390, height: 844 });
  await raise({ width: 1440, height: 900 });
  await raise({ width: 390, height: 844 });
  await writeFile(`${out}/checks.json`, JSON.stringify({ ok: true, checks }, null, 2));
  console.log(`PASS ${checks.length}`);
} catch (error) {
  await writeFile(`${out}/checks.json`, JSON.stringify({ ok: false, checks, error: String(error.stack || error) }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
