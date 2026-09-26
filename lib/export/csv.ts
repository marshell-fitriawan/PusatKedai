/**
 * Serialisasi baris tabel menjadi CSV.
 *
 * Separah titik koma (;) -- Excel versi Indonesia membuka `;` sebagai
 * separator secara default, koma butuh import manual. Nilai yang mengandung
 * separator, kutip, atau baris baru dibungkus kutip ganda dengan kutip di
 * dalamnya di-escape ganda (standar RFC 4180). Angka dikirim mentah supaya
 * spreadsheet bisa menjumlahkannya; format cuma urusan tampilan.
 *
 * Belum ada library CSV di repo ini -- fungsi 20 baris sudah cukup dan
 * tidak menambah dependency.
 */
export function keCsv(header: string[], baris: (string | number | null)[][]): string {
  const escape = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[;",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return [header, ...baris]
    .map((r) => r.map(escape).join(";"))
    .join("\r\n");
}