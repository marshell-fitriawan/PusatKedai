/**
 * Generate ikon PWA dari app/icon.svg.
 *
 * Dijalankan manual (`npm run icons`) saat ikon berubah, bukan tiap build --
 * hasilnya di-commit supaya build produksi tidak butuh sharp.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const source = await readFile(path.join(root, "app", "icon.svg"));
const outDir = path.join(root, "public", "icons");

const targets = [
  // Dirujuk dari app/manifest.ts
  { dir: outDir, file: "icon-192.png", size: 192 },
  { dir: outDir, file: "icon-512.png", size: 512 },
  // Maskable memakai sumber yang sama: latar sudah full-bleed dan bentuknya
  // dijaga di dalam safe zone, jadi aman dipotong bulat/squircle.
  { dir: outDir, file: "icon-maskable-512.png", size: 512 },
  // Konvensi file Next: otomatis jadi <link rel="apple-touch-icon">.
  // Jangan pindah ke public/ -- begitu metadata.icons diisi manual, konvensi
  // file lain (termasuk app/icon.svg untuk favicon) ikut ditimpa.
  { dir: path.join(root, "app"), file: "apple-icon.png", size: 180 },
];

await mkdir(outDir, { recursive: true });

for (const { dir, file, size } of targets) {
  const buffer = await sharp(source).resize(size, size).png().toBuffer();
  await writeFile(path.join(dir, file), buffer);
  console.log(`${path.relative(root, path.join(dir, file))} (${size}x${size})`);
}
