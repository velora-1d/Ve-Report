# PDF_TEMPLATE.md — Spesifikasi Desain Laporan PDF

PDF di-generate server-side memakai Puppeteer (render HTML/CSS → PDF). Gaya visual mengikuti `UI_THEME.md` tapi disederhanakan — fokus keterbacaan & rapi kalau dicetak hitam-putih. Konfigurasi kertas/orientasi/header/footer diambil dari `app_config` (lihat `DATABASE.md` & menu Pengaturan → Konfigurasi PDF).

## Struktur Halaman

### Header (setiap halaman)

- Logo organisasi (kiri) — diambil dari Branding
- Judul laporan (tengah/kanan) — contoh: "Laporan Tugas & Aktivitas"
- Info kecil: periode laporan, tanggal digenerate
- Teks header custom (dari Konfigurasi PDF, jika diisi)

### Bagian Identitas Laporan

- Nama laporan
- Periode (dari tanggal – sampai tanggal)
- Digenerate oleh (nama user)
- Filter yang diterapkan (user tertentu/semua, status tertentu)

### Bagian Ringkasan

- Total tugas dalam periode
- Breakdown status (Selesai/Dikerjakan/Belum Dikerjakan/Ditinjau) — tabel angka + persentase
- Total waktu tercatat (dari Pelacak)
- Tugas terlambat (jika ada) — ditandai jelas

### Bagian Detail Tugas (Tabel)

```
No | Judul Tugas | Ditugaskan ke | Prioritas | Status | Deadline | Waktu Tercatat
```

- Baris zebra (selang-seling warna sangat halus) untuk keterbacaan
- Status ditandai label kecil, bukan warna latar penuh (tetap jelas di cetak hitam-putih)

### Bagian Detail Log Pelacak (opsional, sesuai filter)

```
Tanggal | Tugas | Pengguna | Durasi | Catatan
```

### Footer (setiap halaman)

- Nomor halaman ("Halaman 2 dari 5")
- Nama aplikasi kecil di pojok
- Teks footer custom (dari Konfigurasi PDF, jika diisi)
- Catatan: "Dokumen ini digenerate otomatis oleh sistem VeReport"

## Prinsip Desain PDF

1. Hitam-putih ramah — semua informasi tetap jelas dibaca tanpa warna
2. Tipografi jelas — judul 16-18pt, isi tabel 10-11pt
3. Tidak ada elemen dekoratif berlebihan — fokus ke data
4. Konsisten dengan identitas web — warna aksen dari `UI_THEME.md`, hanya di aksen kecil (garis, label)
5. Margin cukup — sesuai ukuran kertas & margin yang dikonfigurasi di Pengaturan
6. Grafik/chart tetap terbaca hitam-putih — pakai pola/garis, bukan hanya beda warna

## Konfigurasi yang Bisa Diatur (via Pengaturan → Konfigurasi PDF)

- Ukuran kertas: A4 / Letter / Legal
- Orientasi: Potrait / Landscape
- Header PDF: teks custom + logo
- Footer PDF: teks custom
- Margin: default / custom

## Format File

- Nama file otomatis: `Laporan_[NamaLaporan]_[PeriodeAwal]_[PeriodeAkhir].pdf`
- Disimpan di RustFS, akses terbatas (butuh autentikasi/presigned URL untuk download)
