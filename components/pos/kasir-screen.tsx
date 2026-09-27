"use client";

import { useEffect, useMemo, useReducer, useState, type Dispatch } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SyncStatus } from "@/components/pos/sync-status";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  reducerKeranjang,
  totalHarga,
  totalItem,
  type AksiKeranjang,
  type ItemKeranjang,
  type ProdukKasir,
} from "@/lib/pos/cart";
import { simpanKatalog } from "@/lib/offline/catalog";
import { db } from "@/lib/offline/db";
import { syncAntrian } from "@/lib/offline/sync-queue";
import { getDeviceId, nextLocalNumber } from "@/lib/pos/local-number";
import { mulaiQris as mulaiQrisAction } from "@/app/pos/(kasir)/kasir/actions";
import { cn, formatUang } from "@/lib/utils";

const SEMUA = "__semua__";

/** Transaksi QRIS yang sedang menunggu pembayaran. */
type QrisAktif = {
  id: string;
  qrContent: string;
  qrImageUrl: string | null;
  expiresAt: string;
  total: number;
};

/** Struk yang baru selesai, masih tampil sampai kasir menekan "Transaksi Baru". */
type HasilTransaksi = {
  nomor: string;
  total: number;
  sementara: boolean;
  metode: "tunai" | "qris";
};

/**
 * Isi keranjang: pilihan metode bayar, daftar item, dan pesan error.
 *
 * Dipakai dua kali -- di dalam Modal (layar kecil) dan di panel samping
 * (>= 1024px). JSX-nya sengaja TIDAK ditulis dua kali supaya perbaikan
 * tampilan cukup diterapkan di satu tempat dan tidak bisa melenceng antara
 * keduanya.
 */
function IsiKeranjang({
  hasil,
  qris,
  qrisAktif,
  qrImage,
  keranjang,
  metode,
  produk,
  dispatch,
  setMetode,
  setErrorBayar,
  errorBayar,
}: {
  hasil: HasilTransaksi | null;
  qris: QrisAktif | null;
  qrisAktif: boolean;
  qrImage: string | null;
  keranjang: ItemKeranjang[];
  metode: "tunai" | "qris";
  produk: ProdukKasir[];
  dispatch: Dispatch<AksiKeranjang>;
  setMetode: (m: "tunai" | "qris") => void;
  setErrorBayar: (e: string | null) => void;
  errorBayar: string | null;
}) {
  return (
    <>
      {hasil ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex size-14 items-center justify-center border-2 border-ink bg-success text-ink shadow-brutal-sm">
            <CheckCircle2 className="size-7" aria-hidden />
          </span>

          <p className="text-sm text-text-secondary">
            {hasil.sementara ? "Nomor sementara" : "Nomor transaksi"}
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {hasil.sementara ? hasil.nomor : `#${hasil.nomor}`}
          </p>

          <p className="text-sm text-text-secondary">
            {hasil.metode === "qris" ? "Total dibayar QRIS" : "Total dibayar tunai"}
          </p>
          <p className="text-xl font-bold tabular-nums">
            {formatUang(hasil.total)}
          </p>

          {hasil.sementara ? (
            <p className="border-2 border-ink bg-warning p-2 text-xs font-semibold text-ink">
              Tersimpan di perangkat dan akan terkirim otomatis. Nomor resmi
              diberikan setelah tersinkron.
            </p>
          ) : null}
        </div>
      ) : qris ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <p className="text-sm text-text-secondary">
            Minta pelanggan memindai QR di bawah dengan aplikasi pembayaran
            QRIS (Gopay, OVO, ShopeePay, atau bank).
          </p>

          <div className="border-2 border-ink bg-surface-alt p-3">
            {qrImage ? (
              // QR bisa berupa string EMVCo yang dirender di sini, atau
              // gambar langsung dari Midtrans -- keduanya jadi data URL.
              <Image
                src={qrImage}
                alt="QRIS"
                width={240}
                height={240}
                unoptimized
              />
            ) : (
              <Loader2 className="size-10 animate-spin text-text-secondary" aria-hidden />
            )}
          </div>

          <p className="text-base font-bold tabular-nums">
            {formatUang(qris.total)}
          </p>
          <p className="text-xs text-text-secondary">
            Berlaku sampai{" "}
            <span className="font-semibold tabular-nums">
              {new Date(qris.expiresAt).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </p>

          <p className="border-2 border-ink bg-warning p-2 text-xs font-semibold text-ink">
            Jangan batalkan setelah pelanggan mulai memindai — pembayaran
            yang sudah diterima tetap tercatat, walau layar ini ditutup.
          </p>
        </div>
      ) : keranjang.length === 0 ? (
        <p className="text-sm text-text-secondary">Keranjang kosong.</p>
      ) : (
        <>
          {/* Pilihan metode pembayaran. Tunai = offline-first, QRIS =
              online-only (M1-10). QRIS hanya ditampilkan kalau instance-nya
              punya MIDTRANS_SERVER_KEY — lihat qrisAktif. */}
          <div
            className={cn(
              "mb-4 grid gap-2",
              qrisAktif ? "grid-cols-2" : "grid-cols-1",
            )}
            role="radiogroup"
            aria-label="Metode pembayaran"
          >
            <button
              type="button"
              role="radio"
              aria-checked={metode === "tunai"}
              onClick={() => {
                setMetode("tunai");
                setErrorBayar(null);
              }}
              className={cn(
                "flex h-11 items-center justify-center gap-2 border-2 border-ink font-display text-sm font-bold uppercase tracking-tight",
                "shadow-brutal-sm press-brutal",
                metode === "tunai"
                  ? "bg-primary text-ink"
                  : "bg-surface text-ink hover:bg-primary-light",
              )}
            >
              <Wallet className="size-4" aria-hidden />
              Tunai
            </button>

            {qrisAktif ? (
              <button
                type="button"
                role="radio"
                aria-checked={metode === "qris"}
                onClick={() => {
                  setMetode("qris");
                  setErrorBayar(null);
                }}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 border-2 border-ink font-display text-sm font-bold uppercase tracking-tight",
                  "shadow-brutal-sm press-brutal",
                  metode === "qris"
                    ? "bg-primary text-ink"
                    : "bg-surface text-ink hover:bg-primary-light",
                )}
              >
                <QrCode className="size-4" aria-hidden />
                QRIS
              </button>
            ) : null}
          </div>

          <ul className="flex flex-col divide-y divide-ink">
            {keranjang.map((item) => (
              <li key={item.productId} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-text-secondary tabular-nums">
                    {formatUang(item.price)} × {item.qty} ={" "}
                    {formatUang(item.price * item.qty)}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "kurang", productId: item.productId })
                    }
                    aria-label={`Kurangi ${item.name}`}
                    className="tap-target flex items-center justify-center border-2 border-ink bg-surface shadow-brutal-sm press-brutal hover:bg-primary-light"
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>

                  <span className="w-8 text-center font-semibold tabular-nums">
                    {item.qty}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const p = produk.find((x) => x.id === item.productId);
                      if (p) dispatch({ type: "tambah", produk: p });
                    }}
                    aria-label={`Tambah ${item.name}`}
                    className="tap-target flex items-center justify-center border-2 border-ink bg-surface shadow-brutal-sm press-brutal hover:bg-primary-light"
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "hapus", productId: item.productId })
                    }
                    aria-label={`Hapus ${item.name}`}
                    className="tap-target flex items-center justify-center border-2 border-ink bg-danger text-ink shadow-brutal-sm press-brutal"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {errorBayar ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errorBayar}
        </p>
      ) : null}
    </>
  );
}

/**
 * Aksi di bawah keranjang: kosongkan / bayar / batal.
 *
 * Dipisah dari IsiKeranjang karena letaknya berbeda: di Modal ini jadi
 * prop `footer`, di panel samping jadi blok di bawah daftar.
 */
function AksiBayar({
  hasil,
  qris,
  keranjang,
  metode,
  total,
  menyimpan,
  dispatch,
  setKeranjangTerbuka,
  transaksiBaru,
  batalQris,
  bayar,
}: {
  hasil: HasilTransaksi | null;
  qris: QrisAktif | null;
  keranjang: ItemKeranjang[];
  metode: "tunai" | "qris";
  total: number;
  menyimpan: boolean;
  dispatch: Dispatch<AksiKeranjang>;
  setKeranjangTerbuka: (v: boolean) => void;
  transaksiBaru: () => void;
  batalQris: () => void;
  bayar: () => void;
}) {
  return (
    <>
      {hasil ? (
        <Button fullWidth size="lg" onClick={transaksiBaru}>
          Transaksi Baru
        </Button>
      ) : qris ? (
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="ghost" onClick={batalQris} disabled={menyimpan}>
            Batal
          </Button>

          <Button disabled>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Menunggu pembayaran...
          </Button>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="ghost"
            disabled={menyimpan}
            onClick={() => {
              dispatch({ type: "kosongkan" });
              setKeranjangTerbuka(false);
            }}
          >
            Kosongkan
          </Button>

          <Button onClick={bayar} disabled={menyimpan || keranjang.length === 0}>
            {menyimpan
              ? "Menyimpan..."
              : metode === "qris"
                ? `Bayar QRIS ${formatUang(total)}`
                : `Bayar Tunai ${formatUang(total)}`}
          </Button>
        </div>
      )}
    </>
  );
}

export function KasirScreen({
  produk,
  ambangStokMenipis,
  kedaiId,
  shiftId,
  qrisAktif,
}: {
  produk: ProdukKasir[];
  ambangStokMenipis: number;
  kedaiId: string;
  /** null = toko belum dibuka, penjualan tidak bisa dicatat. */
  shiftId: string | null;
  /**
   * false = instance ini tidak punya MIDTRANS_SERVER_KEY, jadi QRIS
   * disembunyikan sepenuhnya dan kasir hanya bisa bayar tunai.
   */
  qrisAktif: boolean;
}) {
  const router = useRouter();
  const [keranjang, dispatch] = useReducer(reducerKeranjang, []);
  const [query, setQuery] = useState("");
  const [kategori, setKategori] = useState(SEMUA);
  const [keranjangTerbuka, setKeranjangTerbuka] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [errorBayar, setErrorBayar] = useState<string | null>(null);
  const [metode, setMetode] = useState<"tunai" | "qris">("tunai");
  const [qris, setQris] = useState<QrisAktif | null>(null);
  const [qr, setQr] = useState<{ forId: string; url: string } | null>(null);
  const [hasil, setHasil] = useState<HasilTransaksi | null>(null);

  // Simpan katalog ke perangkat setiap kali halaman dimuat online, supaya
  // kasir tetap bisa berjualan kalau koneksi hilang setelah ini.
  useEffect(() => {
    void simpanKatalog(kedaiId, produk);
  }, [kedaiId, produk]);

  /**
   * WRITE-LOCAL-FIRST.
   *
   * Transaksi ditulis ke IndexedDB lebih dulu, lalu kasir langsung dilepas
   * ke pelanggan berikutnya. Pengiriman ke server terjadi di latar.
   *
   * Kenapa bukan menunggu server: di kedai dengan sinyal buruk, satu
   * permintaan bisa menggantung 10-30 detik. Kasir yang menunggu itu akan
   * berhenti memakai sistem dan kembali mencatat di kertas.
   */
  async function bayar() {
    if (metode === "qris") return mulaiQris();
    return bayarTunai();
  }

  /**
   * WRITE-LOCAL-FIRST (transaksi tunai).
   *
   * Transaksi ditulis ke IndexedDB lebih dulu, lalu kasir langsung dilepas
   * ke pelanggan berikutnya. Pengiriman ke server terjadi di latar.
   *
   * Kenapa bukan menunggu server: di kedai dengan sinyal buruk, satu
   * permintaan bisa menggantung 10-30 detik. Kasir yang menunggu itu akan
   * berhenti memakai sistem dan kembali mencatat di kertas.
   */
  async function bayarTunai() {
    // Tanpa shift, transaksi tidak punya tempat bergantung -- dan kas tidak
    // akan pernah bisa direkonsiliasi. Dicegah di sini, bukan dibiarkan
    // gagal di server setelah pelanggan menunggu.
    if (!shiftId) {
      setErrorBayar("Toko belum dibuka. Buka toko dulu di menu Shift.");
      return;
    }

    setErrorBayar(null);
    setMenyimpan(true);

    try {
      const deviceId = getDeviceId();
      // ID dibuat di PERANGKAT. Ini yang membuat transaksi punya identitas
      // sejak detik pertama, dan yang membuat pengiriman ulang idempoten.
      const id = crypto.randomUUID();
      const localNumber = nextLocalNumber(deviceId);

      await db.antrian.add({
        id,
        kedaiId,
        shiftId,
        localNumber,
        deviceId,
        createdAt: new Date().toISOString(),
        items: keranjang.map((i) => ({
          product_id: i.productId,
          name: i.name,
          price: i.price,
          qty: i.qty,
        })),
        total,
        status: "pending",
        attempts: 0,
      });

      // Sudah aman di perangkat -- tampilkan sukses sekarang juga.
      setHasil({ nomor: localNumber, total, sementara: true, metode: "tunai" });

      // Kirim di latar. Kalau berhasil cepat (kasus umum saat online),
      // nomor sementara diganti nomor resmi dari server.
      void syncAntrian(kedaiId).then((ringkasan) => {
        const milikKita = ringkasan.hasil.find((h) => h.id === id);
        if (milikKita?.ok && milikKita.transactionNumber) {
          setHasil({
            nomor: milikKita.transactionNumber,
            total,
            sementara: false,
            metode: "tunai",
          });
        }
        router.refresh();
      });
    } catch (err) {
      // Gagal menulis ke IndexedDB. Ini serius: kalau perangkat tidak bisa
      // menyimpan, transaksi benar-benar hilang -- kasir harus tahu.
      setErrorBayar(
        err instanceof Error
          ? `Gagal menyimpan di perangkat: ${err.message}`
          : "Gagal menyimpan di perangkat.",
      );
    } finally {
      setMenyimpan(false);
    }
  }

  /**
   * Pembayaran QRIS (M1-10).
   *
   * BERBEDA DENGAN TUNAI -- QRIS ONLINE-ONLY:
   *   * charge butuh Midtrans, jadi navigator.onLine dicek lebih dulu.
   *   * transaksi TIDAK masuk antrian IndexedDB: QRIS tidak bisa "menunggu
   *     sampai online" karena pembayarannya sendiri butuh internet.
   *   * id transaksi dibuat DI SERVER (lihat mulaiQris di actions.ts); klien
   *     hanya mengirim snapshot keranjang + identitas perangkat.
   *   * transaksi + pengurangan stok baru terjadi saat pembayaran dikonfirmasi
   *     webhook/polling -> confirm_qris_payment, bukan sekarang.
   */
  async function mulaiQris() {
    if (!shiftId) {
      setErrorBayar("Toko belum dibuka. Buka toko dulu di menu Shift.");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setErrorBayar("QRIS butuh koneksi internet.");
      return;
    }

    setErrorBayar(null);
    setMenyimpan(true);

    try {
      const deviceId = getDeviceId();
      const localNumber = nextLocalNumber(deviceId);

      const hasilAction = await mulaiQrisAction({
        items: keranjang.map((i) => ({
          product_id: i.productId,
          name: i.name,
          price: i.price,
          qty: i.qty,
        })),
        localNumber,
        deviceId,
      });

      // Kedua varian hasil sama-sama punya `error` -- yang membedakan ialah
      // kehadiran `id` (hanya ada saat charge berhasil).
      if (!("id" in hasilAction)) {
        setErrorBayar(hasilAction.error);
        return;
      }

      setQris({
        id: hasilAction.id,
        qrContent: hasilAction.qrContent,
        qrImageUrl: hasilAction.qrImageUrl,
        expiresAt: hasilAction.expiresAt,
        total: hasilAction.total,
      });
    } catch (err) {
      setErrorBayar(
        err instanceof Error ? err.message : "Gagal memulai pembayaran QRIS.",
      );
    } finally {
      setMenyimpan(false);
    }
  }

  /**
   * Polling status QRIS (cadangan konfirmasi; jalur utama = webhook).
   * Berhenti sendiri saat selesai/kedaluwarsa -- bukan memakai timer tetap
   * yang memanggil server tanpa henti.
   */
  useEffect(() => {
    if (!qris) return;

    let berhenti = false;
    const timer = setInterval(async () => {
      if (berhenti) return;

      try {
        const res = await fetch(
          `/api/midtrans/status?paymentId=${encodeURIComponent(qris.id)}`,
        );
        const data = (await res.json()) as {
          status?: string;
          transactionNumber?: string;
          total?: number;
        };

        if (data.status === "paid") {
          berhenti = true;
          setHasil({
            nomor: data.transactionNumber ?? "",
            total: data.total ?? qris.total,
            sementara: false,
            metode: "qris",
          });
          setQris(null);
          router.refresh();
          return;
        }

        if (data.status === "expired" || data.status === "failed") {
          berhenti = true;
          setErrorBayar(
            data.status === "expired"
              ? "Pembayaran QRIS kedaluwarsa. Minta pelanggan memindai ulang."
              : "Pembayaran QRIS gagal.",
          );
          setQris(null);
          return;
        }
      } catch {
        // Gagal sekali bukan akhir dunia -- QR masih berlaku, coba lagi.
      }
    }, 2500);

    return () => {
      berhenti = true;
      clearInterval(timer);
    };
  }, [qris, router]);

  /**
   * Generate QR (EMVCo string) menjadi data URL. Tujuan queried by id
   * pembayaran di render, jadi state lama yang tertinggal tidak akan pernah
   * ditampilkan untuk pembayaran yang baru.
   */
  useEffect(() => {
    if (!qris) return;
    if (qris.qrImageUrl) return;
    if (!qris.qrContent) return;

    let berhenti = false;
    void QRCode.toDataURL(qris.qrContent, { width: 240, margin: 1 })
      .then((url) => {
        if (!berhenti) setQr({ forId: qris.id, url });
      })
      .catch(() => {
        // QR tidak bisa dirender -- kasir butuh tahu, bukan diam.
        if (!berhenti) setErrorBayar("Gagal menampilkan QR.");
      });

    return () => {
      berhenti = true;
    };
  }, [qris]);

  function transaksiBaru() {
    dispatch({ type: "kosongkan" });
    setHasil(null);
    setErrorBayar(null);
    setMetode("tunai");
    setQris(null);
    setKeranjangTerbuka(false);
  }

  function batalQris() {
    // Membatalkan TIDAK membatalkan pembayaran di Midtrans: kalau pelanggan
    // sudah memindai dan membayar, webhook tetap mencatat transaksinya.
    // Ini disengaja -- uang yang sudah berpindah tidak boleh hilang diam-diam.
    setQris(null);
    setKeranjangTerbuka(false);
    setErrorBayar(null);
  }

  const kategoriTersedia = useMemo(
    () =>
      [...new Set(produk.map((p) => p.category).filter((c): c is string => !!c))].sort(),
    [produk],
  );

  const terlihat = useMemo(() => {
    const q = query.trim().toLowerCase();
    return produk.filter(
      (p) =>
        (kategori === SEMUA || p.category === kategori) &&
        (q === "" || p.name.toLowerCase().includes(q)),
    );
  }, [produk, query, kategori]);

  const jumlah = totalItem(keranjang);
  const total = totalHarga(keranjang);
  const qrImage = qris
    ? qris.qrImageUrl ?? (qr?.forId === qris.id ? qr.url : null)
    : null;



  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">

        <SyncStatus kedaiId={kedaiId} />

        {!shiftId ? (
          <p className="border-2 border-ink bg-warning p-3 text-sm font-semibold text-ink">
            Toko belum dibuka — penjualan belum bisa dicatat. Buka toko lewat
            menu <strong>Shift</strong>.
          </p>
        ) : null}

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari produk"
            aria-label="Cari produk"
            className="h-11 w-full border-2 border-ink bg-surface pr-3 pl-9 text-base placeholder:text-text-disabled"
          />
        </div>

        {kategoriTersedia.length > 0 ? (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {[SEMUA, ...kategoriTersedia].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKategori(k)}
                aria-pressed={kategori === k}
                className={cn(
                  "h-9 shrink-0 border-2 border-ink px-3 font-display text-xs font-bold uppercase tracking-tight",
                  "shadow-brutal-sm press-brutal",
                  kategori === k
                    ? "bg-primary text-ink"
                    : "bg-surface text-ink hover:bg-primary-light",
                )}
              >
                {k === SEMUA ? "Semua" : k}
              </button>
            ))}
          </div>
        ) : null}

        {terlihat.length === 0 ? (
          <p className="border-2 border-dashed border-ink p-8 text-center text-sm text-text-secondary">
            Tidak ada produk yang cocok.
          </p>
        ) : (
          // 2 kolom di HP (docs/design_1.md), melebar di tablet.
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-4">
            {terlihat.map((p) => {
              const diKeranjang =
                keranjang.find((i) => i.productId === p.id)?.qty ?? 0;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => dispatch({ type: "tambah", produk: p })}
                  className={cn(
                    "flex flex-col overflow-hidden border-2 bg-surface text-left",
                    "shadow-brutal press-brutal",
                    diKeranjang > 0 ? "bg-primary-light" : "border-ink",
                  )}
                >
                  <div className="relative aspect-square w-full bg-surface-alt">
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover"
                      />
                    ) : null}

                    {diKeranjang > 0 ? (
                      <span className="absolute top-1 right-1 flex size-6 items-center justify-center border-2 border-ink bg-primary text-xs font-bold">
                        {diKeranjang}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="text-base font-bold tabular-nums">
                      {formatUang(p.price)}
                    </span>

                    {/* Stok ditampilkan sebagai informasi, BUKAN penghalang.
                        Kasir tetap boleh menjual saat stok nol atau minus --
                        lihat docs/Database.md §7. */}
                    {p.stok <= 0 ? (
                      <Badge tone="danger">Stok {p.stok}</Badge>
                    ) : p.stok <= ambangStokMenipis ? (
                      <Badge tone="warning">Sisa {p.stok}</Badge>
                    ) : (
                      <span className="text-xs text-text-secondary tabular-nums">
                        Stok {p.stok}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/*
        Panel keranjang permanen, layar lebar.

        Di layar kecil keranjang hanya bisa dibuka lewat Modal -- kasir harus
        memencet produk dulu, jadi tidak.screen ada gunanya menampilkan
        panel kosong seharian. Di layar lebar panelnya selalu terlihat:
        kasir menekan produk sekali, langsung bisa lihat total dan menekan
        bayar tanpa langkah kedua. Menghemat satu ketukan per pelanggan --
        pada satu kasir yang melayani 300 transaksi sehari, ini bukan detail kecil.

        Menggantikan bilah ringkasan, bukan menambahkannya. Dua tempat
        menampilkan total yang sama hanya membuat kasir ragu angka mana
        yang benar.
      */}
      <aside
        aria-label="Keranjang"
        className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] w-80 shrink-0 flex-col border-2 border-ink bg-surface shadow-brutal lg:flex 2xl:w-96"
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-primary p-3">
          <span className="font-display text-sm font-bold uppercase tracking-tight">
            {hasil ? "Transaksi Berhasil" : qris ? "Bayar QRIS" : "Keranjang"}
          </span>
          <span className="text-sm font-bold tabular-nums">
            {jumlah} item
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <IsiKeranjang
            hasil={hasil}
            qris={qris}
            qrisAktif={qrisAktif}
            qrImage={qrImage}
            keranjang={keranjang}
            metode={metode}
            produk={produk}
            dispatch={dispatch}
            setMetode={setMetode}
            setErrorBayar={setErrorBayar}
            errorBayar={errorBayar}
          />
        </div>

        <div className="border-t-2 border-ink bg-surface-alt p-3">
          <AksiBayar
            hasil={hasil}
            qris={qris}
            keranjang={keranjang}
            metode={metode}
            total={total}
            menyimpan={menyimpan}
            dispatch={dispatch}
            setKeranjangTerbuka={setKeranjangTerbuka}
            transaksiBaru={transaksiBaru}
            batalQris={batalQris}
            bayar={bayar}
          />
        </div>
      </aside>

      {/*
        Bilah ringkasan + Modal: hanya layar kecil. Di >= 1024px keduanya
        disembunyikan karena panel di atas sudah menampilm convict их.
      */}

      {/* Bilah ringkasan, menempel tepat di atas bottom nav. */}
      {jumlah > 0 ? (
        <div className="fixed inset-x-0 bottom-14 z-10 border-t-2 border-ink bg-primary pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-secondary">
                {jumlah} item
              </p>
              <p className="truncate text-lg font-bold tabular-nums">
                {formatUang(total)}
              </p>
            </div>

            <Button size="lg" onClick={() => setKeranjangTerbuka(true)}>
              <ShoppingCart className="size-5" aria-hidden />
              Lihat Keranjang
            </Button>
          </div>
        </div>
      ) : null}


      <Modal
        open={keranjangTerbuka}
        onClose={() =>
          hasil ? transaksiBaru() : qris ? batalQris() : setKeranjangTerbuka(false)
        }
        title={
          hasil ? "Transaksi Berhasil" : qris ? "Bayar QRIS" : "Keranjang"
        }
        footer={
          <AksiBayar
            hasil={hasil}
            qris={qris}
            keranjang={keranjang}
            metode={metode}
            total={total}
            menyimpan={menyimpan}
            dispatch={dispatch}
            setKeranjangTerbuka={setKeranjangTerbuka}
            transaksiBaru={transaksiBaru}
            batalQris={batalQris}
            bayar={bayar}
          />
        }
      >
        <IsiKeranjang
          hasil={hasil}
          qris={qris}
          qrisAktif={qrisAktif}
          qrImage={qrImage}
          keranjang={keranjang}
          metode={metode}
          produk={produk}
          dispatch={dispatch}
          setMetode={setMetode}
          setErrorBayar={setErrorBayar}
          errorBayar={errorBayar}
        />
      </Modal>
    </div>
  );
}
