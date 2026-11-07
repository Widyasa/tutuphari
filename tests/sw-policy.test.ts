import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const policy = require("../public/sw-policy.js") as {
  CACHE_VERSION: string;
  SHELL_CACHE: string;
  ASSET_CACHE: string;
  decideCache: (input: {
    method?: string;
    pathname?: string;
    search?: string;
    mode?: string;
    authorization?: string;
    rsc?: string;
  }) => string;
};

describe("service worker cache policy", () => {
  it("versions the shell and asset caches and leaves storage keys alone", () => {
    expect(policy.CACHE_VERSION).toBe("tutuphari-v1");
    expect(policy.SHELL_CACHE).toBe("tutuphari-shell-tutuphari-v1");
    expect(policy.ASSET_CACHE).toBe("tutuphari-assets-tutuphari-v1");
    const worker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(worker).not.toMatch(/localStorage\.(get|set|remove|clear)/);
    expect(worker).toContain("caches.delete");
    expect(worker.match(/skipWaiting\(/g)).toHaveLength(1);
    expect(worker).toContain('event.data.type === "SKIP_WAITING"');
  });

  it("never caches API calls, credentials, or non-GET requests", () => {
    expect(policy.decideCache({ method: "POST", pathname: "/api/extract", mode: "cors" })).toBe("network-only");
    expect(policy.decideCache({ method: "GET", pathname: "/api/explain", mode: "cors" })).toBe("network-only");
    expect(policy.decideCache({ method: "GET", pathname: "/", mode: "navigate", authorization: "Bearer secret" })).toBe(
      "network-only",
    );
    expect(policy.decideCache({ method: "GET", pathname: "/", search: "?token=abc", mode: "navigate" })).toBe(
      "network-only",
    );
    expect(policy.decideCache({ method: "GET", pathname: "/", mode: "cors", rsc: "1" })).toBe("network-only");
    expect(policy.decideCache({ method: "GET", pathname: "/sw.js", mode: "same-origin" })).toBe("network-only");
  });

  it("caches the navigation shell and hashed assets only", () => {
    expect(policy.decideCache({ method: "GET", pathname: "/", mode: "navigate" })).toBe("navigate");
    expect(policy.decideCache({ method: "GET", pathname: "/_next/static/chunks/app.js", mode: "same-origin" })).toBe(
      "asset",
    );
    expect(policy.decideCache({ method: "GET", pathname: "/icons/icon-512.png", mode: "same-origin" })).toBe("asset");
    expect(policy.decideCache({ method: "GET", pathname: "/offline.html", mode: "navigate" })).toBe("navigate");
  });
});

describe("pwa icons", () => {
  it("ships original png icons at the manifest sizes", () => {
    for (const [name, size] of [
      ["icon-192.png", 192],
      ["icon-512.png", 512],
      ["icon-maskable-192.png", 192],
      ["icon-maskable-512.png", 512],
    ] as const) {
      const bytes = readFileSync(new URL(`../public/icons/${name}`, import.meta.url));
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(bytes.readUInt32BE(16)).toBe(size);
      expect(bytes.readUInt32BE(20)).toBe(size);
    }
  });
});
