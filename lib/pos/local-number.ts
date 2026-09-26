/**
 * Identitas perangkat dan nomor transaksi SEMENTARA.
 *
 * Nomor final (`transaction_number`) selalu diberikan server, berurutan per
 * kedai per hari. Nomor ini hanya rujukan sementara sebelum transaksi sampai
 * ke server -- dan di M2 nanti, selama masih mengantre offline.
 *
 * Kenapa tidak nomor urut saja dari perangkat: dua kasir yang offline
 * bersamaan di kedai yang sama pasti menghasilkan urutan yang identik, dan
 * tabrakannya baru ketahuan saat sync -- setelah nomornya terlanjur disebut
 * ke pelanggan. Prefix `OFF-` dan potongan id perangkat membuatnya jelas
 * sementara, sekaligus tidak mungkin bentrok antar perangkat.
 *
 * Browser-only: memakai localStorage.
 */

const KEY_DEVICE = "pos_device_id";
const KEY_COUNTER = "pos_local_counter";

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY_DEVICE);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY_DEVICE, id);
  }

  return id;
}

/**
 * Nomor sementara, mis. `OFF-A1B2-0007`.
 *
 * Counter-nya per perangkat dan tidak pernah di-reset. Tujuannya bukan
 * menghitung penjualan harian, melainkan memastikan dua transaksi dari
 * perangkat yang sama tidak pernah memakai label yang sama -- itu juga yang
 * dijaga unique index `transactions_local_number_per_device`.
 */
export function nextLocalNumber(deviceId: string): string {
  const n = Number(localStorage.getItem(KEY_COUNTER) ?? "0") + 1;
  localStorage.setItem(KEY_COUNTER, String(n));

  const prefix = deviceId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `OFF-${prefix}-${String(n).padStart(4, "0")}`;
}
