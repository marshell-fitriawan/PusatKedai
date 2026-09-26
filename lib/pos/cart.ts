/**
 * State keranjang kasir.
 *
 * Dipisah dari komponen supaya logika hitungnya bisa diuji sendiri dan --
 * lebih penting lagi -- bisa dipindahkan ke penyimpanan lokal (IndexedDB) di
 * M2 tanpa menyentuh tampilan sama sekali.
 *
 * Harga disimpan sebagai SNAPSHOT di dalam keranjang, bukan dibaca ulang dari
 * katalog saat checkout. Kalau admin mengubah harga di tengah transaksi,
 * pelanggan tetap membayar angka yang tadi disebutkan kasir.
 */

export type ProdukKasir = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  image_url: string | null;
  stok: number;
};

export type ItemKeranjang = {
  productId: string;
  name: string;
  price: number;
  qty: number;
};

export type Keranjang = ItemKeranjang[];

export type AksiKeranjang =
  | { type: "tambah"; produk: ProdukKasir }
  | { type: "kurang"; productId: string }
  | { type: "hapus"; productId: string }
  | { type: "kosongkan" };

export function reducerKeranjang(
  state: Keranjang,
  aksi: AksiKeranjang,
): Keranjang {
  switch (aksi.type) {
    case "tambah": {
      const ada = state.find((i) => i.productId === aksi.produk.id);
      if (ada) {
        return state.map((i) =>
          i.productId === aksi.produk.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [
        ...state,
        {
          productId: aksi.produk.id,
          name: aksi.produk.name,
          price: aksi.produk.price,
          qty: 1,
        },
      ];
    }

    case "kurang": {
      const ada = state.find((i) => i.productId === aksi.productId);
      // Qty 1 dikurangi = item hilang dari keranjang. Menyisakan item ber-qty
      // nol cuma membingungkan kasir saat memeriksa ulang pesanan.
      if (ada && ada.qty <= 1) {
        return state.filter((i) => i.productId !== aksi.productId);
      }
      return state.map((i) =>
        i.productId === aksi.productId ? { ...i, qty: i.qty - 1 } : i,
      );
    }

    case "hapus":
      return state.filter((i) => i.productId !== aksi.productId);

    case "kosongkan":
      return [];
  }
}

export function totalItem(keranjang: Keranjang): number {
  return keranjang.reduce((n, i) => n + i.qty, 0);
}

export function totalHarga(keranjang: Keranjang): number {
  return keranjang.reduce((n, i) => n + i.price * i.qty, 0);
}
