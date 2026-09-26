/*
 * Service worker — kerangka awal (M0-11).
 *
 * Cakupannya sengaja minimal: hanya cukup supaya aplikasi memenuhi syarat
 * "installable" (butuh fetch handler yang tetap merespons saat offline).
 *
 * Antrian transaksi offline TIDAK ditangani di sini. Itu dikerjakan di M2
 * lewat IndexedDB (Dexie) + background sync, karena transaksi harus tahan
 * restart browser dan tidak boleh bergantung pada siklus hidup cache.
 */

const CACHE = "multi-kedai-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      // Kasir tidak boleh menunggu tab lama ditutup untuk dapat versi baru.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Hanya navigasi yang ditangani. Request data (API/Supabase) sengaja
  // dibiarkan lewat apa adanya supaya tidak ada respons basi yang menyamar
  // jadi data valid -- untuk POS, data stok basi lebih berbahaya daripada
  // error jaringan yang terlihat jelas.
  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        const fallback = await cache.match(OFFLINE_URL);
        return (
          fallback ??
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
    })(),
  );
});
