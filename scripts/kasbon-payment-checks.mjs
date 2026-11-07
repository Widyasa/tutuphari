import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://127.0.0.1:43227";
const out = process.env.KASBON_OUT ?? "/opt/cursor/artifacts/kasbon-fix-after";
await mkdir(`${out}/screenshots`, { recursive: true });
await mkdir(`${out}/storage`, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const checks = [];
function note(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name} ${detail}`);
  if (!ok) throw new Error(`${name}: ${detail}`);
}

async function readStore(page) {
  const raw = await page.evaluate(() => localStorage.getItem("tutuphari.v1"));
  return raw ? JSON.parse(raw) : null;
}

async function dump(page, name) {
  const store = await readStore(page);
  await writeFile(`${out}/storage/${name}.json`, JSON.stringify(store, null, 2));
  return store;
}

function payments(store) {
  return store.active.entries.filter((entry) => entry.type === "kasbon_bayar");
}

function rupiahAfter(text, label) {
  const pattern = label === "Uang laci seharusnya"
    ? /Uang laci seharusnya(?: sementara)?\s*(Rp[\d.]+)/i
    : new RegExp(`${label}\\s*(Rp[\\d.]+)`, "i");
  return text.match(pattern)?.[1] ?? null;
}

async function run(viewport) {
  const tag = `${viewport.width}`;
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#warung").fill("QA-TEST-R3b");
  await page.locator("#modal").fill("200000");
  await page.getByRole("button", { name: "Mulai catat" }).click();
  await page.locator("#draft-note").fill("kasbon bu qatest 30rb tunai");
  await page.getByRole("button", { name: "Kirim — ekstrak catatan" }).click();
  await page.getByRole("button", { name: "Konfirmasi catatan ini" }).click();
  await page.waitForTimeout(200);

  async function home() {
    if (await page.getByRole("button", { name: "Batalkan ke Hari Ini" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Batalkan ke Hari Ini" }).click();
    } else if (await page.getByRole("button", { name: "Kembali" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Kembali" }).click();
      if (await page.getByRole("button", { name: "Kembali" }).isVisible().catch(() => false)) {
        await page.getByRole("button", { name: "Kembali" }).click();
      }
    } else {
      await page.getByRole("button", { name: "Hari Ini", exact: true }).click();
    }
    await page.getByRole("heading", { name: "Hari ini" }).waitFor();
    return page.locator("body").innerText();
  }

  let text = await home();
  let store = await dump(page, `${tag}-debt`);
  await page.screenshot({ path: `${out}/screenshots/${tag}-debt.png` });
  note(`${tag} debt expected`, rupiahAfter(text, "Uang laci seharusnya") === "Rp170.000", rupiahAfter(text, "Uang laci seharusnya"));
  note(`${tag} debt rows`, store.active.entries.length === 1 && store.active.entries[0].counterparty === "Bu Qatest", JSON.stringify(store.active.entries.map((entry) => entry.type)));

  async function openPay(person, amount) {
    await page.getByRole("button", { name: "Kasbon", exact: true }).click();
    await page.getByRole("heading", { name: "Buku kasbon" }).waitFor();
    if (await page.getByRole("button", { name: "Batal" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Batal" }).click();
    }
    await page.getByRole("button", { name: "Catat bayar kasbon" }).click();
    await page.locator("#pay-name").fill(person);
    await page.locator("#pay-amount").fill(String(amount));
  }

  await openPay("Bu Qatest", 10000);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Simpan pembayaran"));
    button?.click();
    button?.click();
  });
  await page.waitForTimeout(300);
  store = await dump(page, `${tag}-partial`);
  text = await page.locator("body").innerText();
  await page.screenshot({ path: `${out}/screenshots/${tag}-partial.png` });
  note(`${tag} partial once`, payments(store).length === 1 && payments(store)[0].amount === 10000, `rows=${payments(store).length}`);
  note(`${tag} partial balance`, rupiahAfter(text, "Total belum lunas") === "Rp20.000", rupiahAfter(text, "Total belum lunas"));
  text = await home();
  note(`${tag} partial expected`, rupiahAfter(text, "Uang laci seharusnya") === "Rp180.000", rupiahAfter(text, "Uang laci seharusnya"));
  await page.reload({ waitUntil: "networkidle" });
  store = await dump(page, `${tag}-partial-reload`);
  note(`${tag} partial reload`, payments(store).length === 1, `rows=${payments(store).length}`);

  await openPay("Bu Qatest", 25000);
  await page.getByRole("button", { name: "Simpan pembayaran" }).click();
  const tooMuchAlert = page.locator("p[role=alert]");
  await tooMuchAlert.waitFor();
  const tooMuch = await tooMuchAlert.innerText();
  store = await dump(page, `${tag}-too-much`);
  await page.screenshot({ path: `${out}/screenshots/${tag}-too-much.png` });
  note(`${tag} exceeds message`, tooMuch === "Pembayaran Rp25.000 melebihi sisa utang Rp20.000. Pembayaran tidak dicatat.", tooMuch);
  note(`${tag} exceeds unsaved`, payments(store).length === 1, `rows=${payments(store).length}`);

  await openPay("Bu Qatest", 20000);
  await page.getByRole("button", { name: "Simpan pembayaran" }).click();
  await page.waitForTimeout(200);
  store = await dump(page, `${tag}-full`);
  text = await page.locator("body").innerText();
  await page.screenshot({ path: `${out}/screenshots/${tag}-full.png` });
  note(`${tag} full rows`, payments(store).length === 2 && payments(store).reduce((sum, entry) => sum + entry.amount, 0) === 30000, `rows=${payments(store).length}`);
  note(`${tag} full balance`, text.includes("Belum ada kasbon yang belum lunas."), "list");
  text = await home();
  note(`${tag} full expected`, rupiahAfter(text, "Uang laci seharusnya") === "Rp200.000", rupiahAfter(text, "Uang laci seharusnya"));
  const idsBefore = payments(store).map((entry) => entry.id);
  await page.reload({ waitUntil: "networkidle" });
  store = await dump(page, `${tag}-full-reload`);
  note(`${tag} full reload ids`, JSON.stringify(payments(store).map((entry) => entry.id)) === JSON.stringify(idsBefore), "ids");

  await openPay("Bu Qatest", 5000);
  await page.getByRole("button", { name: "Simpan pembayaran" }).click();
  const excessNode = page.locator("p[role=alert]");
  await excessNode.waitFor();
  const excessAlert = await excessNode.innerText();
  store = await dump(page, `${tag}-excess`);
  await page.screenshot({ path: `${out}/screenshots/${tag}-excess.png` });
  note(`${tag} excess message`, excessAlert === "Bu Qatest tidak punya utang aktif. Pembayaran tidak dicatat.", excessAlert);
  note(`${tag} excess unsaved`, payments(store).length === 2, `rows=${payments(store).length}`);
  text = await home();
  note(`${tag} excess expected`, rupiahAfter(text, "Uang laci seharusnya") === "Rp200.000", rupiahAfter(text, "Uang laci seharusnya"));

  await openPay("QA-TEST-R3b-TanpaUtang", 7000);
  await page.getByRole("button", { name: "Simpan pembayaran" }).click();
  const unmatchedNode = page.locator("p[role=alert]");
  await unmatchedNode.waitFor();
  const unmatched = await unmatchedNode.innerText();
  store = await dump(page, `${tag}-unmatched`);
  await page.screenshot({ path: `${out}/screenshots/${tag}-unmatched.png` });
  note(`${tag} unmatched message`, unmatched === "QA-TEST-R3b-TanpaUtang tidak punya utang aktif. Pembayaran tidak dicatat.", unmatched);
  note(`${tag} unmatched unsaved`, payments(store).length === 2 && new Set(payments(store).map((entry) => entry.id)).size === 2, "rows");

  const resume = viewport.width >= 1024 ? "Catat lagi" : "Lanjutkan catat";
  await page.getByRole("button", { name: "Hari Ini", exact: true }).click();
  await page.getByRole("button", { name: resume }).click();
  await page.locator("#draft-note").fill("bu qatest bayar kasbon 5rb tunai");
  await page.getByRole("button", { name: "Kirim — ekstrak catatan" }).click();
  await page.getByRole("button", { name: "Konfirmasi catatan ini" }).click();
  await page.waitForTimeout(300);
  store = await dump(page, `${tag}-confirm-reject`);
  const drafted = store.active.entries.find((entry) => entry.sourceText === "bu qatest bayar kasbon 5rb tunai");
  const notice = await page.locator("p[aria-live=polite]").innerText();
  await page.screenshot({ path: `${out}/screenshots/${tag}-confirm-reject.png` });
  note(`${tag} confirm stays draft`, drafted?.status === "draft" && drafted?.type === "kasbon_bayar", JSON.stringify(drafted));
  note(`${tag} confirm message`, notice.includes("tidak punya utang aktif"), notice);
  text = await home();
  note(`${tag} confirm expected`, rupiahAfter(text, "Uang laci seharusnya") === "Rp200.000", rupiahAfter(text, "Uang laci seharusnya"));
  await page.reload({ waitUntil: "networkidle" });
  store = await dump(page, `${tag}-final-reload`);
  note(`${tag} final payments`, payments(store).filter((entry) => entry.status === "confirmed").length === 2, "confirmed payments");
  await context.close();
}

try {
  await run({ width: 1440, height: 900 });
  await run({ width: 390, height: 844 });
  await writeFile(`${out}/checks.json`, JSON.stringify({ ok: true, checks }, null, 2));
  console.log(`PASS ${checks.length}`);
} catch (error) {
  await writeFile(`${out}/checks.json`, JSON.stringify({ ok: false, checks, error: String(error.stack || error) }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
