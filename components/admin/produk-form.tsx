"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { AlertCircle, ImagePlus, Loader2, X } from "lucide-react";
import {
  createProduk,
  updateProduk,
  type FormState,
} from "@/app/admin/(dashboard)/produk/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { GAMBAR_MIME } from "@/lib/storage";
import { hapusGambarProduk, unggahGambarProduk } from "@/lib/storage-client";
import type { Tables } from "@/lib/database.types";

const initialState: FormState = { error: null };

function Actions({
  onCancel,
  disabled,
}: {
  onCancel: () => void;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={pending}>
        Batal
      </Button>
      <Button type="submit" disabled={pending || disabled}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </>
  );
}

export function ProdukForm({
  open,
  onClose,
  produk,
  kategoriTersedia,
}: {
  open: boolean;
  onClose: () => void;
  /** Ada = mode ubah, tidak ada = mode tambah. */
  produk?: Tables<"products">;
  /** Kategori yang sudah dipakai, untuk saran autocomplete. */
  kategoriTersedia: string[];
}) {
  const action = produk ? updateProduk.bind(null, produk.id) : createProduk;
  const [state, formAction] = useActionState(action, initialState);

  const [imageUrl, setImageUrl] = useState<string | null>(
    produk?.image_url ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  async function pilihGambar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      const urlBaru = await unggahGambarProduk(file);

      // Kalau user sudah sempat mengunggah lalu mengganti pilihan sebelum
      // menyimpan, unggahan perantara itu dibersihkan di sini. Gambar ASLI
      // milik produk tidak disentuh -- itu urusan server action, dan hanya
      // setelah penyimpanan berhasil.
      if (imageUrl && imageUrl !== produk?.image_url) {
        await hapusGambarProduk(imageUrl);
      }

      setImageUrl(urlBaru);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Gagal mengunggah gambar.");
    } finally {
      setUploading(false);
      // Reset supaya memilih file yang sama dua kali tetap memicu onChange.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function hapusGambar() {
    if (imageUrl && imageUrl !== produk?.image_url) {
      await hapusGambarProduk(imageUrl);
    }
    setImageUrl(null);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={produk ? "Ubah Produk" : "Tambah Produk"}
    >
      <form action={formAction} className="flex flex-col gap-4">
        {/* URL gambar dikirim sebagai teks; byte-nya sudah diunggah langsung
            ke Storage dari browser, tidak lewat server action. */}
        <input type="hidden" name="image_url" value={imageUrl ?? ""} />

        <Input
          label="Nama produk"
          name="name"
          defaultValue={produk?.name ?? ""}
          error={state.fieldErrors?.name}
          placeholder="Kopi Susu Gula Aren"
          required
          autoFocus
        />

        <Input
          label="Harga"
          name="price"
          numeric
          defaultValue={String(produk?.price ?? "")}
          error={state.fieldErrors?.price}
          placeholder="12"
          hint="Ringgit (RM), tanpa titik atau koma"
          required
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="produk-kategori" className="text-sm font-semibold">
            Kategori
          </label>
          <input
            id="produk-kategori"
            name="category"
            list="daftar-kategori"
            defaultValue={produk?.category ?? ""}
            placeholder="kopi"
            className="h-11 border-2 border-ink bg-surface px-3 text-base placeholder:text-text-disabled"
          />
          <datalist id="daftar-kategori">
            {kategoriTersedia.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <p className="text-xs text-text-secondary">
            Untuk mengelompokkan produk di layar kasir. Boleh dikosongkan.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Gambar</span>

          {imageUrl ? (
            <div className="flex items-center gap-3">
              <Image
                src={imageUrl}
                alt="Pratinjau gambar produk"
                width={80}
                height={80}
                className="size-20 border-2 border-ink object-cover"
              />
              <Button variant="secondary" size="sm" onClick={hapusGambar}>
                <X className="size-4" aria-hidden />
                Hapus gambar
              </Button>
            </div>
          ) : null}

          <label className="tap-target inline-flex w-fit cursor-pointer items-center gap-2 border-2 border-ink bg-surface px-4 font-display text-xs font-bold uppercase tracking-tight text-ink shadow-brutal-sm press-brutal hover:bg-primary-light">
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="size-4" aria-hidden />
            )}
            {uploading ? "Mengunggah..." : imageUrl ? "Ganti gambar" : "Pilih gambar"}
            <input
              ref={fileRef}
              type="file"
              accept={GAMBAR_MIME.join(",")}
              onChange={pilihGambar}
              disabled={uploading}
              className="sr-only"
            />
          </label>

          <p className="text-xs text-text-secondary">
            JPG, PNG, atau WebP. Maksimal 2 MB.
          </p>

          {uploadError ? (
            <p role="alert" className="text-xs text-danger-text">
              {uploadError}
            </p>
          ) : null}
        </div>

        {state.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end gap-3">
          <Actions onCancel={onClose} disabled={uploading} />
        </div>
      </form>
    </Modal>
  );
}
