import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.env.BASE_URL ?? "http://127.0.0.1:43227";
const out = "/opt/cursor/artifacts/pwa";
await mkdir(out, { recursive: true });

const swSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const policySource = await readFile(new URL("../public/sw-policy.js", import.meta.url), "utf8");
let swVersion = "tutuphari-v1";
process.on("exit", () => {
  writeFileSync(new URL("../public/sw.js", import.meta.url), swSource);
  writeFileSync(new URL("../public/sw-policy.js", import.meta.url), policySource);
});

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext();
const page = await context.newPage();
const checks = [];
const shots = [];
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

function note(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) throw new Error(`${name}: ${detail}`);
}

await context.route("**/sw.js", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/javascript",
    headers: { "cache-control": "no-cache" },
    body: swVersion === "tutuphari-v1" ? swSource : `${swSource}\n// build ${swVersion}\n`,
  });
});
await context.route("**/sw-policy.js", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/javascript",
    headers: { "cache-control": "no-cache" },
    body: swVersion === "tutuphari-v1" ? policySource : policySource.replaceAll("tutuphari-v1", swVersion),
  });
});

await page.addInitScript(() => {
  window.__installPrompt = false;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.__installPrompt = true;
  });
});

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });

const manifestLink = await page.locator('link[rel="manifest"]').getAttribute("href");
note("manifest link", !!manifestLink, manifestLink ?? "missing");
const manifestResponse = await page.request.get(new URL(manifestLink, base).toString());
const manifest = await manifestResponse.json();
note("manifest name", manifest.name === "TutupHari" && manifest.short_name === "TutupHari", JSON.stringify(manifest.name));
note("manifest display", manifest.display === "standalone", manifest.display);
note("manifest scope", manifest.scope === "/" && manifest.start_url === "/", `${manifest.scope} ${manifest.start_url}`);
note("manifest light", manifest.background_color === "#F5F5F4" && manifest.theme_color === "#F5F5F4", manifest.theme_color);
const purposes = new Set(manifest.icons.map((icon) => icon.purpose));
note("manifest icons", purposes.has("any") && purposes.has("maskable") && manifest.icons.length >= 4, JSON.stringify(manifest.icons));

const client = await context.newCDPSession(page);
let installability = { supported: false, errors: [] };
try {
  const result = await client.send("Page.getInstallabilityErrors");
  installability = { supported: true, errors: result.installabilityErrors ?? result.errors ?? [] };
} catch (error) {
  installability = { supported: false, errors: [String(error)] };
}
let appManifest = null;
try {
  appManifest = await client.send("Page.getAppManifest");
} catch (error) {
  appManifest = { error: String(error) };
}
const critical = (appManifest?.errors ?? []).filter((error) => error.critical);
note("browser manifest", critical.length === 0, JSON.stringify(appManifest?.errors ?? appManifest?.error ?? []));
const blockingInstallErrors = installability.supported
  ? installability.errors.filter((error) => error.errorId !== "in-incognito")
  : [];
if (installability.supported) {
  note(
    "installability errors",
    blockingInstallErrors.length === 0,
    JSON.stringify(installability.errors),
  );
} else {
  checks.push({ name: "installability errors", ok: true, detail: "CDP method unavailable; manifest parse used instead" });
}

await page.getByRole("button", { name: "Coba demo" }).click();
await page.getByTestId("home-expected").waitFor();
await page.screenshot({ path: `${out}/shell-online-mobile.png` });
shots.push(`${out}/shell-online-mobile.png`);
note("no update before a version bump", (await page.getByTestId("sw-update").count()) === 0, "prompt already visible");

const swReady = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return { scope: reg.scope, script: reg.active?.scriptURL ?? "", state: reg.active?.state ?? "" };
});
note("service worker registered", swReady.state === "activated" && swReady.scope === `${base}/`, JSON.stringify(swReady));
const installPrompt = await page.evaluate(() => window.__installPrompt === true);

const safeTop = await page.evaluate(() => getComputedStyle(document.getElementById("app-shell")).paddingTop);
note("desktop safe-area inset observed", safeTop === "0px", safeTop);

await page.getByRole("button", { name: "Lanjutkan catat" }).click();
await page.locator("#draft-note").fill("catatan tetap aman");
await page.evaluate(() => document.documentElement.style.setProperty("--kb", "320px"));
const cta = await page.getByTestId("primary-cta").boundingBox();
note("keyboard cta still visible", !!cta && cta.y + cta.height <= 844 - 280, JSON.stringify(cta));
await page.screenshot({ path: `${out}/keyboard-mobile.png` });
shots.push(`${out}/keyboard-mobile.png`);
await page.evaluate(() => document.documentElement.style.setProperty("--kb", "0px"));
await page.getByRole("button", { name: "Kembali" }).click();
await page.getByTestId("home-expected").waitFor();
await page.getByRole("button", { name: "Lanjutkan catat" }).click();
note("back keeps draft under sw", (await page.locator("#draft-note").inputValue()) === "catatan tetap aman", "draft missing");
await page.getByRole("button", { name: "Kembali" }).click();

const before = await page.evaluate(() => localStorage.getItem("tutuphari.v1"));
note("ledger stored", !!before && before.includes("120000"), "missing store");

await page.evaluate(() => {
  sessionStorage.setItem(
    "tutuphari.nav.v3",
    JSON.stringify({ dest: "hari", step: "catat", draft: "catatan tetap aman" }),
  );
});
await context.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByTestId("offline-banner").waitFor({ timeout: 15000 });
await page.locator("#app-shell").waitFor();
const offlineText = await page.locator("body").innerText();
note(
  "offline shell",
  offlineText.includes("Data demo") && offlineText.includes("AI tidak tersedia") && offlineText.includes("Catat"),
  offlineText.slice(0, 280),
);
await page.screenshot({ path: `${out}/shell-offline-mobile.png` });
shots.push(`${out}/shell-offline-mobile.png`);

await page.locator("#draft-note").fill("jual kopi 1 10rb tunai");
await page.getByRole("button", { name: "Kirim — ekstrak catatan" }).click();
await page.getByTestId("read-label").waitFor();
const offlineLabel = await page.getByTestId("read-label").innerText();
note(
  "offline rule label",
  offlineLabel.includes("AI tidak tersedia") && offlineLabel.includes("tanpa AI"),
  offlineLabel,
);
const offlineStore = await page.evaluate(() => localStorage.getItem("tutuphari.v1") ?? "");
note("offline entry is rule", offlineStore.includes('"parser":"rule"') && offlineStore.includes("jual kopi 1 10rb tunai"), "rule entry missing");
await page.screenshot({ path: `${out}/offline-catat-mobile.png` });
shots.push(`${out}/offline-catat-mobile.png`);

await context.setOffline(false);
let aiCalls = 0;
await page.route("**/api/extract", async (route) => {
  if (route.request().method() !== "POST") {
    await route.fulfill({ status: 405, body: "" });
    return;
  }
  aiCalls += 1;
  const body = JSON.parse(route.request().postData() || "{}");
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      parser: "ai",
      model: "grok-test",
      entries: [
        {
          type: "penjualan",
          amount: 8000,
          method: "tunai",
          item: "teh",
          qty: 1,
          counterparty: null,
          confidence: 0.9,
          sourceText: body.text,
          needsConfirmation: false,
          question: null,
          parser: "ai",
        },
      ],
    }),
  });
});
await page.evaluate(() => {
  sessionStorage.setItem("tutuphari.nav.v3", JSON.stringify({ dest: "hari", step: "catat", draft: "" }));
});
await page.reload({ waitUntil: "networkidle" });
await page.locator("#draft-note").waitFor();
await page.locator("#draft-note").fill("jual teh 1 8rb tunai");
await page.getByRole("button", { name: "Kirim — ekstrak catatan" }).click();
await page.getByText("Dibaca dengan AI.").waitFor();
note("reconnect uses AI", aiCalls === 1, `calls=${aiCalls}`);
await page.screenshot({ path: `${out}/reconnect-ai-mobile.png` });
shots.push(`${out}/reconnect-ai-mobile.png`);

const cachedApi = await page.evaluate(async () => {
  const urls = [];
  for (const key of await caches.keys()) {
    const cache = await caches.open(key);
    for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
  }
  return urls.filter((pathname) => pathname.startsWith("/api/"));
});
note("api not cached", cachedApi.length === 0, cachedApi.join(","));

const storeBeforeClear = await page.evaluate(() => localStorage.getItem("tutuphari.v1"));
await page.evaluate(async () => {
  for (const key of await caches.keys()) {
    if (key.startsWith("tutuphari-")) await caches.delete(key);
  }
});
await page.reload({ waitUntil: "networkidle" });
const storeAfterClear = await page.evaluate(() => localStorage.getItem("tutuphari.v1"));
note(
  "cache clear keeps notes",
  !!storeAfterClear && storeAfterClear.includes("jual kopi 1 10rb tunai") && storeAfterClear.includes("120000"),
  "notes missing after the app cache was deleted",
);
await page.evaluate(() => {
  const raw = localStorage.getItem("tutuphari.v1");
  const store = JSON.parse(raw);
  store.active.draftNote = "catatan tetap aman";
  localStorage.setItem("tutuphari.v1", JSON.stringify(store));
  sessionStorage.setItem(
    "tutuphari.nav.v3",
    JSON.stringify({ dest: "hari", step: "catat", draft: "catatan tetap aman" }),
  );
});

await page.evaluate(() => {
  sessionStorage.setItem("tutuphari.nav.v3", JSON.stringify({ dest: "hari", step: null, draft: "catatan tetap aman" }));
});
swVersion = "tutuphari-v2";
await writeFile("public/sw.js", `${swSource}\n// build ${swVersion}\n`);
await writeFile("public/sw-policy.js", policySource.replaceAll("tutuphari-v1", swVersion));
const prompt = page.getByTestId("sw-update");
await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.update();
});
await prompt.waitFor({ timeout: 15000 });
await page.screenshot({ path: `${out}/update-prompt-mobile.png` });
shots.push(`${out}/update-prompt-mobile.png`);
const duringPrompt = await page.evaluate(() => localStorage.getItem("tutuphari.v1"));
note(
  "prompt keeps draft",
  !!duringPrompt &&
    duringPrompt.includes("catatan tetap aman") &&
    duringPrompt.includes("jual kopi 1 10rb tunai") &&
    duringPrompt.includes("120000"),
  "notes missing when the update prompt appeared",
);
await page.getByRole("button", { name: "Muat ulang" }).click();
await page.waitForLoadState("networkidle");
await page.getByTestId("home-expected").waitFor({ timeout: 15000 });
const afterUpdate = await page.evaluate(() => localStorage.getItem("tutuphari.v1"));
note(
  "update keeps notes",
  !!afterUpdate &&
    afterUpdate.includes("catatan tetap aman") &&
    afterUpdate.includes("jual kopi 1 10rb tunai") &&
    afterUpdate.includes("120000"),
  "notes missing after the service worker update",
);
const versions = await page.evaluate(async () => (await caches.keys()).filter((key) => key.startsWith("tutuphari-")));
note("old caches removed", versions.every((key) => key.includes("tutuphari-v2")) && versions.length > 0, versions.join(","));
await page.screenshot({ path: `${out}/after-update-mobile.png` });
shots.push(`${out}/after-update-mobile.png`);

await page.setViewportSize({ width: 1440, height: 900 });
await page.screenshot({ path: `${out}/shell-desktop.png` });
shots.push(`${out}/shell-desktop.png`);

await writeFile(
  `${out}/checks.json`,
  JSON.stringify(
    { checks, shots, installPrompt, installability, manifestErrors: appManifest?.errors ?? null, consoleErrors },
    null,
    2,
  ),
);
await browser.close();
console.log(JSON.stringify({ checks, shots, installPrompt, installability, consoleErrors }, null, 2));
