"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pemindai QR memakai kamera HP.
 *
 * Library-nya (html5-qrcode) diimpor DINAMIS dan hanya saat kamera benar-
 * benar dinyalakan. Ukurannya sekitar setengah megabyte -- memuatnya di
 * setiap kunjungan halaman akan memperlambat pembukaan sesi, padahal kasir
 * yang memasukkan kode manual tidak membutuhkannya sama sekali.
 *
 * CATATAN PENGUJIAN: jalur kamera BELUM diuji di perangkat nyata. Ia butuh
 * HTTPS dan izin kamera, jadi tidak bisa diverifikasi dari baris perintah.
 * Masukan manual di halaman pemanggil adalah jalur yang sudah teruji, dan
 * sengaja dipertahankan sebagai cadangan -- kamera HP bisa rusak atau
 * izinnya ditolak di tengah shift.
 */
export function QrScanner({
  onScan,
  disabled,
}: {
  onScan: (text: string) => void;
  disabled?: boolean;
}) {
  const [aktif, setAktif] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wadahId = useId().replace(/:/g, "");
  // Ref ke instance scanner supaya bisa dihentikan saat komponen dilepas --
  // tanpa ini, kamera tetap menyala setelah pindah halaman.
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  // Callback dipindah ke ref supaya efek di bawah tidak ikut jalan ulang
  // tiap kali induknya render ulang (onScan biasanya fungsi inline).
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  /**
   * Hentikan kamera dengan aman.
   *
   * html5-qrcode MELEMPAR error sinkron ("Cannot stop, scanner is not running
   * or paused."), bukan menolak Promise, kalau stop() dipanggil saat kamera
   * tidak menyala. Itu terjadi normal: React mode ketat melepas efek sebelum
   * start() selesai, dan setelah satu QR terbaca kita berhenti dua kali.
   * .catch() saja tidak menangkap lemparan sinkron, jadi harus try/catch.
   */
  const hentikanScanner = useCallback(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    // Kosongkan lebih dulu supaya tidak ada pemanggilan stop() kedua.
    scannerRef.current = null;
    try {
      void Promise.resolve(scanner.stop()).catch(() => {});
    } catch {
      // Kamera memang sudah berhenti -- tidak ada yang perlu dilakukan.
    }
  }, []);

  useEffect(() => {
    if (!aktif) return;

    let dibatalkan = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (dibatalkan) return;

        const scanner = new Html5Qrcode(wadahId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => {
            onScanRef.current(text);
            // Kamera dimatikan begitu satu kode terbaca. Membiarkannya
            // menyala akan memicu pembacaan berulang dari kartu yang sama.
            hentikanScanner();
            setAktif(false);
          },
          () => {
            // Callback ini dipanggil tiap frame yang tidak memuat QR.
            // Diabaikan: itu keadaan normal, bukan kesalahan.
          },
        );
      } catch (err) {
        if (dibatalkan) return;
        setError(
          err instanceof Error
            ? `Kamera tidak bisa dibuka: ${err.message}`
            : "Kamera tidak bisa dibuka.",
        );
        setAktif(false);
      }
    })();

    return () => {
      dibatalkan = true;
      hentikanScanner();
    };
  }, [aktif, wadahId, hentikanScanner]);

  return (
    <div className="flex flex-col gap-2">
      <div
        id={wadahId}
        className={aktif ? "overflow-hidden border-2 border-ink" : "hidden"}
      />

      <Button
        variant="secondary"
        fullWidth
        disabled={disabled}
        onClick={() => {
          setError(null);
          setAktif((v) => !v);
        }}
      >
        {aktif ? (
          <>
            <CameraOff className="size-4" aria-hidden />
            Matikan kamera
          </>
        ) : (
          <>
            <Camera className="size-4" aria-hidden />
            Pindai kartu QR
          </>
        )}
      </Button>

      {error ? (
        <p role="alert" className="text-xs text-danger-text">
          {error} Masukkan kode kartu secara manual di bawah.
        </p>
      ) : null}
    </div>
  );
}
