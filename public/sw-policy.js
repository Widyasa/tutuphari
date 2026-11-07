/* Cache decisions for the TutupHari service worker.
   Notes and drafts stay in localStorage. This file never reads them. */
(function (root) {
  var CACHE_VERSION = "tutuphari-v1";

  function decideCache(input) {
    var method = input.method || "GET";
    var pathname = input.pathname || "/";
    var search = input.search || "";
    if (method !== "GET") return "network-only";
    if (input.authorization) return "network-only";
    if (input.rsc) return "network-only";
    if (/(?:^|[?&])(?:key|token|secret|password|code)=/i.test(search)) return "network-only";
    if (pathname.indexOf("/api/") === 0) return "network-only";
    if (pathname === "/sw.js" || pathname === "/sw-policy.js") return "network-only";
    if (input.mode === "navigate") return "navigate";
    if (
      pathname.indexOf("/_next/static/") === 0 ||
      pathname.indexOf("/icons/") === 0 ||
      pathname === "/manifest.webmanifest" ||
      pathname === "/offline.html" ||
      pathname === "/precache.json"
    ) {
      return "asset";
    }
    return "network-only";
  }

  var api = {
    CACHE_VERSION: CACHE_VERSION,
    SHELL_CACHE: "tutuphari-shell-" + CACHE_VERSION,
    ASSET_CACHE: "tutuphari-assets-" + CACHE_VERSION,
    decideCache: decideCache,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.tutuphariPolicy = api;
})(typeof self !== "undefined" ? self : globalThis);
