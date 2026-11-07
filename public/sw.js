/* TutupHari app-shell worker.
   A new version waits until the page posts SKIP_WAITING.
   It never caches /api, credentials, or AI responses, and it does not read or write browser storage. */
importScripts("/sw-policy.js");

var policy = self.tutuphariPolicy;
var SHELL_URLS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(precache());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.indexOf("tutuphari-") === 0 && key.indexOf(policy.CACHE_VERSION) === -1;
            })
            .map(function (key) {
              return caches.delete(key);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  var decision = policy.decideCache({
    method: request.method,
    pathname: url.pathname,
    search: url.search,
    mode: request.mode,
    authorization: request.headers.get("authorization") || "",
    rsc: request.headers.get("rsc") || request.headers.get("next-router-prefetch") || "",
  });
  if (decision === "navigate") {
    event.respondWith(networkFirstDocument(request));
  } else if (decision === "asset") {
    event.respondWith(cacheFirstAsset(request));
  }
});

function precache() {
  return caches.open(policy.SHELL_CACHE).then(function (shell) {
    return putEach(shell, SHELL_URLS, true).then(function () {
      return caches.open(policy.ASSET_CACHE).then(function (assets) {
        return fetch("/precache.json", { cache: "reload" })
          .then(function (response) {
            if (!response.ok) return [];
            return response.json();
          })
          .catch(function () {
            return [];
          })
          .then(function (list) {
            if (!Array.isArray(list)) return;
            return putEach(assets, list, false);
          });
      });
    });
  });
}

function putEach(cache, urls, required) {
  return Promise.all(
    urls.map(function (url) {
      return withTimeout(fetch(url, { cache: "reload" }), 8000, url)
        .then(function (response) {
          if (!response.ok) {
            if (required) throw new Error("Tidak bisa menyimpan " + url);
            return;
          }
          return withTimeout(cache.put(url, response), 8000, "put " + url);
        })
        .catch(function (error) {
          console.warn(String(error), url);
          if (required) throw error;
        });
    }),
  );
}

function withTimeout(promise, ms, label) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error("timeout " + label));
    }, ms);
    promise.then(
      function (value) {
        clearTimeout(timer);
        resolve(value);
      },
      function (error) {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function networkFirstDocument(request) {
  return caches.open(policy.SHELL_CACHE).then(function (cache) {
    return fetch(request)
      .then(function (response) {
        if (response.ok) cache.put("/", response.clone());
        return response;
      })
      .catch(function () {
        return cache.match("/").then(function (cached) {
          if (cached) return cached;
          return cache.match("/offline.html").then(function (offline) {
            return (
              offline ||
              new Response("TutupHari offline", {
                status: 503,
                headers: { "content-type": "text/plain; charset=utf-8" },
              })
            );
          });
        });
      });
  });
}

function cacheFirstAsset(request) {
  return caches.open(policy.ASSET_CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}
