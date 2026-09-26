"use client";

import { useEffect } from "react";

/**
 * Mendaftarkan service worker di produksi saja.
 *
 * Sengaja tidak aktif di development: cache shell bikin perubahan kode
 * tampak tidak berlaku dan memancing debugging yang salah arah.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // Gagal daftar SW tidak boleh menjatuhkan aplikasi -- kasir tetap
        // bisa jualan selama online.
        console.error("Pendaftaran service worker gagal:", error);
      });
    };

    // Tunggu load selesai supaya pendaftaran tidak berebut bandwidth dengan
    // render awal halaman kasir.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
